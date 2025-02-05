const snowflake = require('snowflake-sdk');

// SELECT * FROM fact_table ORDER BY id;

export const handler = async (event) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USERNAME,
        password: process.env.SNOWFLAKE_PASSWORD,
        database: process.env.SNOWFLAKE_DATABASE,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE,
        schema: process.env.SNOWFLAKE_SCHEMA,
        host: process.env.SNOWFLAKE_HOST
    });

    try {
        await new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        // Example ETL process
        const setupQueries = [
            // 1. Create raw staging table
            `
            CREATE TABLE IF NOT EXISTS raw_staging (
                id INTEGER,
                column1 VARCHAR,
                column2 VARCHAR,
                column3 INTEGER
            );
            `,
            // 2. Create fact table
            `
            CREATE TABLE IF NOT EXISTS fact_table (
                id INTEGER PRIMARY KEY,
                column1 VARCHAR,
                column2 VARCHAR,
                column3 INTEGER,
                created_at TIMESTAMP_NTZ,
                updated_at TIMESTAMP_NTZ
            );
            `,
            // 3. Check if raw_staging is empty
            `
            INSERT INTO raw_staging (id, column1, column2, column3)
            SELECT * FROM (
                SELECT 1 as id, 'test data 1' as column1, 'value_1' as column2, 42 as column3
                UNION ALL SELECT 2, 'test data 2', NULL, 50
                UNION ALL SELECT 3, 'test data 3', 'value_3', 75
            ) s
            WHERE NOT EXISTS (SELECT 1 FROM raw_staging);
            `
        ];

        const transformationQueries = [
            // 4. Clean staging data
            `
            CREATE OR REPLACE TABLE clean_staging AS
            SELECT 
                id,
                TRIM(column1) as column1,
                COALESCE(column2, 'unknown') as column2,
                CASE 
                    WHEN column3 < 0 THEN 0 
                    ELSE column3 
                END as column3
            FROM raw_staging;
            `,
            // 5. Transform and load to fact table
            `
            MERGE INTO fact_table f
            USING clean_staging s
            ON f.id = s.id
            WHEN MATCHED THEN
                UPDATE SET
                    f.column1 = s.column1,
                    f.column2 = s.column2,
                    f.column3 = s.column3,
                    f.updated_at = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN
                INSERT (id, column1, column2, column3, created_at)
                VALUES (s.id, s.column1, s.column2, s.column3, CURRENT_TIMESTAMP());
            `
        ];

        // Execute setup queries first
        for (const query of setupQueries) {
            await new Promise((resolve, reject) => {
                connection.execute({
                    sqlText: query,
                    complete: (err, stmt) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(stmt);
                        }
                    }
                });
            });
        }

        // Then execute transformation queries
        for (const query of transformationQueries) {
            await new Promise((resolve, reject) => {
                connection.execute({
                    sqlText: query,
                    complete: (err, stmt) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(stmt);
                        }
                    }
                });
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'ETL process completed successfully'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    } finally {
        await new Promise((resolve) => {
            connection.destroy((err) => {
                resolve();
            });
        });
    }
};
