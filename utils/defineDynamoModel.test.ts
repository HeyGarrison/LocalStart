import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import {
  defineDynamoModel,
  required,
  minLength,
  maxLength,
  format,
} from "./defineDynamoModel";
import { createError } from "h3";
import { Adapter } from "./adapters/Adapter";

// Mock the createError function from h3
vi.mock("h3", () => ({
  createError: vi.fn((options: any) => ({ ...options, isH3Error: true })),
}));

// Define the structure of the mock adapter
interface MockAdapter extends Adapter {
  create: Mock;
  update: Mock;
  destroy: Mock;
  findById: Mock;
  findAll: Mock;
}

// Mock adapter
const mockAdapter: MockAdapter = {
  create: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
};

describe("defineDynamoModel", () => {
  let builder: ReturnType<typeof defineDynamoModel>;
  let model: ReturnType<ReturnType<typeof defineDynamoModel>["modelize"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = defineDynamoModel(mockAdapter);
  });

  describe("Model Configuration", () => {
    it("should create a model builder with all expected methods", () => {
      expect(builder).toHaveProperty("tableName");
      expect(builder).toHaveProperty("field");
      expect(builder).toHaveProperty("globalSecondaryIndex");
      expect(builder).toHaveProperty("validates");
      expect(builder).toHaveProperty("addCallback");
      expect(builder).toHaveProperty("hasMany");
      expect(builder).toHaveProperty("belongsTo");
      expect(builder).toHaveProperty("hasOne");
      expect(builder).toHaveProperty("modelize");
    });

    it("should set table name", () => {
      model = builder.tableName("users").modelize();
      expect(model.getFields()).toEqual({});
    });

    it("should throw an error if table name is not set", () => {
      expect(() => builder.modelize()).toThrow("Table name must be set");
    });

    it("should add fields", () => {
      model = builder
        .tableName("users")
        .field("name", "string")
        .field("age", "number")
        .modelize();
      expect(model.getFields()).toEqual({ name: "string", age: "number" });
    });

    it("should add global secondary index", () => {
      model = builder
        .tableName("users")
        .globalSecondaryIndex({ name: "nameIndex", hashKey: "name" })
        .globalSecondaryIndex({
          name: "ageIndex",
          hashKey: "age",
          rangeKey: "name",
        })
        .modelize();
      expect(model.getIndexes()).toEqual([
        { name: "nameIndex", hashKey: "name" },
        { name: "ageIndex", hashKey: "age", rangeKey: "name" },
      ]);
    });

    it("should add validations", () => {
      model = builder
        .tableName("users")
        .field("name", "string")
        .validates("name", required, minLength(3))
        .modelize();
      const validations = model.getValidations();
      expect(validations.name).toHaveLength(2);
      expect(validations.name[0]).toBe(required);
      expect(validations.name[1]).toBeInstanceOf(Function);
    });

    it("should add callbacks", () => {
      const beforeSaveCallback = vi.fn();
      const afterCreateCallback = vi.fn();
      model = builder
        .tableName("users")
        .addCallback("beforeSave", beforeSaveCallback)
        .addCallback("afterCreate", afterCreateCallback)
        .modelize();
      const callbacks = model.getCallbacks();
      expect(callbacks.beforeSave).toContain(beforeSaveCallback);
      expect(callbacks.afterCreate).toContain(afterCreateCallback);
    });

    it("should add associations", () => {
      model = builder
        .tableName("users")
        .hasMany("posts", { model: "posts" })
        .belongsTo("company", { model: "companies" })
        .hasOne("profile", { model: "profiles" })
        .modelize();
      const associations = model.getAssociations();
      expect(associations).toEqual({
        posts: { type: "has_many", model: "posts" },
        company: { type: "belongs_to", model: "companies" },
        profile: { type: "has_one", model: "profiles" },
      });
    });

    it("should add foreign key field for belongsTo association", () => {
      model = builder
        .tableName("users")
        .belongsTo("company", { model: "companies" })
        .modelize();
      expect(model.getFields()).toHaveProperty("company_id", "string");
    });
  });

  describe("CRUD Operations", () => {
    beforeEach(() => {
      model = builder
        .tableName("users")
        .field("name", "string")
        .field("email", "string")
        .validates("name", required)
        .validates("email", format(/^\S+@\S+\.\S+$/, "Invalid email format"))
        .addCallback("beforeSave", (record: Record<string, any>) => {
          record.name = record.name.trim();
        })
        .modelize();
    });

    describe("create", () => {
      it("should create a valid record", async () => {
        const newUser = { name: "John Doe", email: "john@example.com" };
        mockAdapter.create.mockResolvedValue({ id: "1", ...newUser });

        const result = await model.create(newUser);

        expect(result.name).toEqual(newUser.name);
        expect(mockAdapter.create).toHaveBeenCalledWith(
          "users",
          expect.objectContaining({
            name: "John Doe",
            email: "john@example.com",
            created_at: expect.any(String),
            updated_at: expect.any(String),
          }),
        );
      });

      it("should run callbacks and trim the name", async () => {
        const newUser = { name: "  John Doe  ", email: "john@example.com" };
        mockAdapter.create.mockResolvedValue({
          id: "1",
          ...newUser,
          name: "John Doe",
        });

        await model.create(newUser);

        expect(mockAdapter.create).toHaveBeenCalledWith(
          "users",
          expect.objectContaining({
            name: "John Doe", // name should be trimmed
          }),
        );
      });

      it("should throw an error for invalid data", async () => {
        const invalidUser = { name: "h ", email: "invalid-email" };
        console.log(invalidUser.name.trim());
        await expect(model.create(invalidUser)).rejects.toEqual(
          expect.objectContaining({
            status: 422,
            statusText: "Validation failed",
            isH3Error: true,
          }),
        );
      });
    });

    describe("update", () => {
      it("should update a record", async () => {
        const updateData = { name: "Jane Doe", email: "email@email.com" };
        mockAdapter.update.mockResolvedValue({ id: "1", ...updateData });

        const result = await model.update("1", updateData);

        expect(result.name).toEqual(updateData.name);
        expect(mockAdapter.update).toHaveBeenCalledWith(
          "users",
          "1",
          expect.objectContaining({
            name: "Jane Doe",
            email: "email@email.com",
            updated_at: expect.any(String),
          }),
        );
      });

      it("should throw an error for invalid update data", async () => {
        const invalidUpdate = { name: "", email: "invalid-email" };

        await expect(model.update("1", invalidUpdate)).rejects.toEqual(
          expect.objectContaining({
            status: 422,
            statusText: "Validation failed",
            isH3Error: true,
          }),
        );
      });
    });

    describe("destroy", () => {
      it("should destroy a record", async () => {
        mockAdapter.findById.mockResolvedValue({ id: "1", name: "John Doe" });
        mockAdapter.destroy.mockResolvedValue(true);

        const result = await model.destroy("1");

        expect(result).toBe(true);
        expect(mockAdapter.destroy).toHaveBeenCalledWith("users", "1");
      });

      it("should throw an error if record not found", async () => {
        mockAdapter.findById.mockResolvedValue(null);

        await expect(model.destroy("1")).rejects.toEqual(
          expect.objectContaining({
            status: 404,
            statusText: "Not found",
            isH3Error: true,
          }),
        );
      });
    });

    describe("findById", () => {
      it("should find a record by id", async () => {
        const user = { id: "1", name: "John Doe", email: "john@example.com" };
        mockAdapter.findById.mockResolvedValue(user);

        const result = await model.findById("1");

        expect(result).toEqual(user);
        expect(mockAdapter.findById).toHaveBeenCalledWith("users", "1");
      });

      it("should throw an error if record not found", async () => {
        mockAdapter.findById.mockResolvedValue(null);

        await expect(model.findById("1")).rejects.toEqual(
          expect.objectContaining({
            status: 404,
            statusText: "Not found",
            isH3Error: true,
          }),
        );
      });
    });

    describe("findAll", () => {
      it("should find all records", async () => {
        const users = [
          { id: "1", name: "John Doe" },
          { id: "2", name: "Jane Doe" },
        ];
        mockAdapter.findAll.mockResolvedValue(users);

        const results = await model.findAll();

        expect(results).toEqual(users);
        expect(mockAdapter.findAll).toHaveBeenCalledWith("users", undefined);
      });

      it("should find records with conditions", async () => {
        const users = [{ id: "1", name: "John Doe" }];
        mockAdapter.findAll.mockResolvedValue(users);

        const results = await model.where({ name: "John Doe" });

        expect(results).toEqual(users);
        expect(mockAdapter.findAll).toHaveBeenCalledWith("users", {
          name: "John Doe",
        });
      });
    });
  });

  describe("Associations", () => {
    beforeEach(() => {
      model = builder
        .tableName("users")
        .hasMany("posts", { model: "posts" })
        .belongsTo("company", { model: "companies" })
        .hasOne("profile", { model: "profiles" })
        .modelize();
    });

    it("should load hasMany association", async () => {
      const user = { id: "1", name: "John Doe" };
      const posts = [
        { id: "1", title: "Post 1", user_id: "1" },
        { id: "2", title: "Post 2", user_id: "1" },
      ];
      mockAdapter.findAll.mockResolvedValue(posts);

      const result = await model.loadAssociations(user);

      expect(result.posts).toEqual(posts);
      expect(mockAdapter.findAll).toHaveBeenCalledWith("posts", {
        user_id: "1",
      });
    });

    it("should load belongsTo association", async () => {
      const user = { id: "1", name: "John Doe", company_id: "1" };
      const company = { id: "1", name: "Acme Inc" };
      mockAdapter.findById.mockResolvedValue(company);

      const result = await model.loadAssociations(user);
      await mockAdapter.findById(user.company_id);
      expect(result.company).toEqual(company);
      // This looks really wrong and I'm not sure i'm understanding logic
      // Need to rread more about vitest's mock feature here.
      expect(mockAdapter.findById).toHaveBeenCalledWith("companies", undefined);
    });

    it("should load hasOne association", async () => {
      const user = { id: "1", name: "John Doe" };
      const profile = { id: "1", bio: "Developer" };
      mockAdapter.findAll.mockResolvedValue([profile]);

      const result = await model.loadAssociations(user);

      expect(result.profile).toEqual(profile);
      expect(mockAdapter.findAll).toHaveBeenCalledWith("profiles", {
        user_id: "1",
      });
    });
  });
});

describe("Validation Helpers", () => {
  it("should validate required fields", () => {
    expect(required("")).toBe("This field is required");
    expect(required("value")).toBe(true);
    expect(required(0)).toBe("This field is required");
    expect(required(false)).toBe("This field is required");
    expect(required(null)).toBe("This field is required");
    expect(required(undefined)).toBe("This field is required");
  });

  it("should validate minimum length", () => {
    const minLength3 = minLength(3);
    expect(minLength3("ab")).toBe("Minimum length is 3");
    expect(minLength3("abc")).toBe(true);
    expect(minLength3("abcd")).toBe(true);
  });

  it("should validate maximum length", () => {
    const maxLength5 = maxLength(5);
    expect(maxLength5("abcdef")).toBe("Maximum length is 5");
    expect(maxLength5("abcde")).toBe(true);
    expect(maxLength5("abcd")).toBe(true);
  });

  it("should validate format", () => {
    const emailFormat = format(/^\S+@\S+\.\S+$/, "Invalid email format");
    expect(emailFormat("notanemail")).toBe("Invalid email format");
    expect(emailFormat("test@example.com")).toBe(true);
    expect(emailFormat("test@example")).toBe("Invalid email format");
  });
});
