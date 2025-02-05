import fetch from 'node-fetch';
import snowflake from 'snowflake-sdk';
import { S3 } from '@aws-sdk/client-s3';

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
        // Connect to Snowflake
        await new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        // Fetch data from URL
        const url = 'https://raw.githubusercontent.com/localstack/presentations/main/2024-03-26_Snowflake_Meetup/cdc-moderna-covid-19-vaccine.csv';
        const response = await fetch(url);
        const data = await response.text();

        // Initialize S3 client
        const s3 = new S3({
            endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
            region: process.env.AWS_REGION || 'us-east-1',
            forcePathStyle: true
        });

        const bucket = process.env.S3_BUCKET || 'default-bucket';
        const key = 'covid-data.csv';

        // Upload to S3
        await s3.putObject({
            Bucket: bucket,
            Key: key,
            Body: data
        });

        // Create stage if not exists
        const createStageQuery = `
            CREATE STAGE IF NOT EXISTS my_s3_stage
            URL = 's3://${bucket}'
            CREDENTIALS = (AWS_KEY_ID = '${process.env.AWS_ACCESS_KEY_ID}' 
                         AWS_SECRET_KEY = '${process.env.AWS_SECRET_ACCESS_KEY}');
        `;

        await new Promise((resolve, reject) => {
            connection.execute({
                sqlText: createStageQuery,
                complete: (err, stmt) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stmt);
                    }
                }
            });
        });

        // Create table if not exists
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS covid_vaccine_data (
                date DATE,
                location STRING,
                total_vaccinations FLOAT,
                people_vaccinated FLOAT,
                people_fully_vaccinated FLOAT,
                daily_vaccinations_raw FLOAT,
                daily_vaccinations FLOAT,
                total_vaccinations_per_hundred FLOAT,
                people_vaccinated_per_hundred FLOAT,
                people_fully_vaccinated_per_hundred FLOAT,
                daily_vaccinations_per_million FLOAT,
                vaccines STRING,
                source_name STRING,
                source_website STRING
            );
        `;

        await new Promise((resolve, reject) => {
            connection.execute({
                sqlText: createTableQuery,
                complete: (err, stmt) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stmt);
                    }
                }
            });
        });

        // Copy data into target table
        const copyQuery = `
            COPY INTO covid_vaccine_data
            FROM @my_s3_stage/${key}
            FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',' SKIP_HEADER = 1)
            ON_ERROR = 'CONTINUE';
        `;

        const result = await new Promise((resolve, reject) => {
            connection.execute({
                sqlText: copyQuery,
                complete: (err, stmt, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            });
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Data loaded successfully',
                details: result
            })
        };
    } catch (error) {
        console.error('Error:', error);
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
