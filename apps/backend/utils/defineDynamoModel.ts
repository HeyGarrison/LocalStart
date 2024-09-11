import { Adapter } from "./adapters/Adapter";
import { createError } from "h3";

type ValidationRule = (value: any) => boolean | string;
type Validations = Record<string, ValidationRule[]>;
type CallbackFunction = (
  record: Record<string, any>,
) => boolean | void | Promise<boolean | void>;
type CallbackEvent =
  | "beforeSave"
  | "afterSave"
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDestroy"
  | "afterDestroy";

type AssociationType = "has_many" | "belongs_to" | "has_one";
type Association = {
  type: AssociationType;
  model: string;
  foreignKey?: string;
};

class CallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallbackError";
  }
}

export function defineDynamoModel(adapter: Adapter) {
  let _tableName: string;
  let _fields: Record<string, string> = {};
  let _indexes: Array<{ name: string; hashKey: string; rangeKey?: string }> =
    [];
  let _validations: Validations = {};
  let _callbacks: Record<CallbackEvent, CallbackFunction[]> = {
    beforeSave: [],
    afterSave: [],
    beforeCreate: [],
    afterCreate: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDestroy: [],
    afterDestroy: [],
  };
  let _associations: Record<string, Association> = {};

  const builder = {
    tableName(name: string) {
      _tableName = name;
      return builder;
    },

    field(name: string, type: string) {
      _fields[name] = type;
      return builder;
    },

    globalSecondaryIndex(options: {
      name: string;
      hashKey: string;
      rangeKey?: string;
    }) {
      _indexes.push(options);
      return builder;
    },

    validates(fieldName: string, ...rules: ValidationRule[]) {
      if (!_validations[fieldName]) {
        _validations[fieldName] = [];
      }
      _validations[fieldName].push(...rules);
      return builder;
    },

    addCallback(event: CallbackEvent, fn: CallbackFunction) {
      _callbacks[event].push(fn);
      return builder;
    },
    hasMany(name: string, options: { model: string; foreignKey?: string }) {
      _associations[name] = { type: "has_many", ...options };
      return builder;
    },

    belongsTo(name: string, options: { model: string; foreignKey?: string }) {
      _associations[name] = { type: "belongs_to", ...options };
      const foreignKey = options.foreignKey || `${name}_id`;
      _fields[foreignKey] = "string";
      return builder;
    },

    hasOne(name: string, options: { model: string; foreignKey?: string }) {
      _associations[name] = { type: "has_one", ...options };
      return builder;
    },
    modelize() {
      if (!_tableName) {
        throw new Error("Table name must be set");
      }

      const validateRecord = (record: Record<string, any>): string[] => {
        const errors: string[] = [];
        for (const [field, rules] of Object.entries(_validations)) {
          for (const rule of rules) {
            const result = rule(record[field]);
            if (result !== true) {
              errors.push(
                typeof result === "string"
                  ? result
                  : `Validation failed for ${field}`,
              );
            }
          }
        }
        return errors;
      };

      const runCallbacks = async (
        event: CallbackEvent,
        record: Record<string, any>,
      ): Promise<void> => {
        for (const callback of _callbacks[event]) {
          try {
            const result = await callback(record);
            if (result === false) {
              throw new CallbackError(`${event} callback halted the operation`);
            }
          } catch (error) {
            if (error instanceof CallbackError) {
              throw error;
            } else {
              throw new CallbackError(
                `Error in ${event} callback: ${error.message}`,
              );
            }
          }
        }
      };

      // We'll add the returned object in the next step
      return {
        async create(record: Record<string, any>) {
          try {
            await runCallbacks("beforeCreate", record);
            await runCallbacks("beforeSave", record);

            const errors = validateRecord(record);
            if (errors.length > 0) {
              throw createError({
                status: 422,
                statusText: "Validation failed",
                data: errors,
              });
            }

            record.created_at = new Date().toISOString();
            record.updated_at = new Date().toISOString();
            const result = await adapter.create(_tableName, record);

            await runCallbacks("afterCreate", result);
            await runCallbacks("afterSave", result);

            return result;
          } catch (error) {
            if (error instanceof CallbackError) {
              throw createError({
                status: 422,
                statusText: error.message,
              });
            }
            throw error;
          }
        },

        async update(id: string, attributes: Record<string, any>) {
          try {
            await runCallbacks("beforeUpdate", attributes);
            await runCallbacks("beforeSave", attributes);

            const errors = validateRecord(attributes);
            if (errors.length > 0) {
              throw createError({
                status: 422,
                statusText: "Validation failed",
                data: errors,
              });
            }

            attributes.updated_at = new Date().toISOString();
            const result = await adapter.update(_tableName, id, attributes);

            await runCallbacks("afterUpdate", result);
            await runCallbacks("afterSave", result);

            return result;
          } catch (error) {
            if (error instanceof CallbackError) {
              throw createError({
                status: 422,
                statusText: error.message,
              });
            }
            throw error;
          }
        },

        async destroy(id: string) {
          try {
            const record = await this.findById(id);
            await runCallbacks("beforeDestroy", record);

            const result = await adapter.destroy(_tableName, id);

            await runCallbacks("afterDestroy", record);
            return result;
          } catch (error) {
            if (error instanceof CallbackError) {
              throw createError({
                status: 422,
                statusText: error.message,
              });
            }
            throw error;
          }
        },

        async findById(id: string) {
          const result = await adapter.findById(_tableName, id);
          if (!result) {
            throw createError({
              status: 404,
              statusText: "Not found",
            });
          }
          return this.loadAssociations(result);
        },

        async findAll(params: Record<string, any> = _fields) {
          const results = await adapter.findAll(_tableName, {
            id: params.id,
          });
          return results;
        },

        async where(conditions: Record<string, any>) {
          const results = await adapter.findAll(_tableName, conditions);
          return Promise.all(
            results.map((result) => this.loadAssociations(result)),
          );
        },

        async loadAssociations(record: Record<string, any>) {
          for (const [name, association] of Object.entries(_associations)) {
            switch (association.type) {
              case "has_many":
                record[name] = await this.loadHasMany(record, association);
                break;
              case "belongs_to":
                record[name] = await this.loadBelongsTo(record, association);
                break;
              case "has_one":
                record[name] = await this.loadHasOne(record, association);
                break;
            }
          }
          return record;
        },

        async loadHasMany(
          record: Record<string, any>,
          association: Association,
        ) {
          const foreignKey =
            association.foreignKey || `${_tableName.slice(0, -1)}_id`;
          return adapter.findAll(association.model, {
            [foreignKey]: record.id,
          });
        },

        async loadBelongsTo(
          record: Record<string, any>,
          association: Association,
        ) {
          const foreignKey =
            association.foreignKey || `${association.model}_id`;
          return adapter.findById(association.model, record[foreignKey]);
        },

        async loadHasOne(
          record: Record<string, any>,
          association: Association,
        ) {
          const foreignKey =
            association.foreignKey || `${_tableName.slice(0, -1)}_id`;
          const results = await adapter.findAll(association.model, {
            [foreignKey]: record.id,
          });
          return results[0];
        },

        getFields() {
          return _fields;
        },

        getIndexes() {
          return _indexes;
        },

        getValidations() {
          return _validations;
        },

        getCallbacks() {
          return _callbacks;
        },

        getAssociations() {
          return _associations;
        },
      };
    },
  };

  return builder;
}

// Validation helpers
export const required = (value: any) => !!value || "This field is required";
export const minLength = (min: number) => (value: string) =>
  value.length >= min || `Minimum length is ${min}`;
export const maxLength = (max: number) => (value: string) =>
  value.length <= max || `Maximum length is ${max}`;
export const format = (regex: RegExp, message: string) => (value: string) =>
  regex.test(value) || message;
