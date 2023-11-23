# Server

This folder contains all code for the server side of this project. The 
following are instructions on how to set up and run the server.

## Installation

To install all server-side libraries and dependencies, run the following 
command while standing in the /server folder:
 
 ```bash
npm install
```

## Database

The server is dependent on a mongodb database running. This should be done 
in a separate terminal from the one the server will run in. A folder called 
mongodb is provided, this is where the database should be run. Standing in the 
/server folder, start the database with the following command:

```bash
mongod --dbpath ./mongodb
```

## Start the server

The avarage user should ignore this section as the server is started from the 
root when the project is run normaly. For instructions on how to start the server 
from the root, look in the README.md in the /project folder.

The server can be started on its own (without the client) using the following 
command, provided there is a database running:

```bash
npm run start
```

It can also be run in dev mode using the following command:

```bash
npm run dev
```

Observe that running the server alone is only usefull for developers, the browser 
will not contain the usual webpage shown when running the program normally.

## Testing

The project has tests to make sure the server is working as intended. They can be
run with the following command once 
the database is initialized:

```bash
npm run test
```

Additionally, you can generate a new test-coverage file using:
```bash
npm run coverage
```


