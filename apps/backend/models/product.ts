import {
  defineDynamoModel,
  required,
  minLength,
  maxLength,
} from "../utils/defineDynamoModel";
import { dynamodbAdapter } from "../utils/adapters/dynamodbAdapter";

// Need to get some types in here
// we already have some basic validation, etc
// I'd hate to add another dep, but valibot and zod are interesting...
export const Product = defineDynamoModel(dynamodbAdapter)
  .tableName("products")
  .field("id", "string")
  .field("name", "string")
  .field("description", "string")
  .field("price", "number")
  .field("category", "string")
  .field("stock", "number")
  .field("created_at", "string")
  .field("updated_at", "string")
  .globalSecondaryIndex({
    name: "CategoryIndex",
    hashKey: "category",
    rangeKey: "name",
  })
  .validates("name", required, minLength(3), maxLength(100))
  .validates("description", required, maxLength(1000))
  .validates(
    "price",
    required,
    (value) => value >= 0 || "Price must be non-negative",
  )
  .validates("category", required)
  .validates(
    "stock",
    (value) =>
      (Number.isInteger(value) && value >= 0) ||
      "Stock must be a non-negative integer",
  )
  .addCallback("beforeCreate", (record) => {
    // You can add any logic here, for example:
    record.created_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
  })
  .addCallback("beforeUpdate", (record) => {
    record.updated_at = new Date().toISOString();
  })
  .modelize();
