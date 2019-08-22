# oxa-backend

Installation
1. Clone this repository
2. Open terminal and run `yarn install` or `npm install`
3. Set up your database by import `oxabackend.sql` file using MySql
4. Add this to your .env file
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASS=root
DB_NOTE=oxabackend

PORT=4000

ENC_ALGORITHM=aes256
ENC_PASS=oxabackend
JWT_KEY=oxabackend
