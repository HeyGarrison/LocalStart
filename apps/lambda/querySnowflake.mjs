const snowflake = require('snowflake-sdk');

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

        const queries = [
            'SELECT * FROM raw_staging ORDER BY id;',
            'SELECT * FROM clean_staging ORDER BY id;',
            'SELECT * FROM fact_table ORDER BY id;'
        ];

        const results = {};
        
        for (const query of queries) {
            const result = await new Promise((resolve, reject) => {
                connection.execute({
                    sqlText: query,
                    complete: (err, stmt, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    }
                });
            });
            
            const tableName = query.match(/FROM (\w+)/)[1];
            results[tableName] = result;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(results, null, 2)
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
