export type Adapter = {
  create: (
    tableName: string,
    attributes: Record<string, any>,
  ) => Promise<Record<string, any>>;
  findAll: (
    tableName: string,
    params?: Record<string, any>,
  ) => Promise<Record<string, any>[]>;
  findById: (
    tableName: string,
    id: string,
  ) => Promise<Record<string, any> | undefined>;
  update: (
    tableName: string,
    id: string,
    attributes: Record<string, any>,
  ) => Promise<Record<string, any> | undefined>;
  destroy: (tableName: string, id: string) => Promise<boolean>;
};
