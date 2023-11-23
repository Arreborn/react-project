# Project

This is the source files for Twooter, a social website for chatting with 
friends. The following are instructions on how to set up and run the website.

## Installation

To install all relevant libraries and dependencies, run the following 
command while standing in the root folder:
 
 ```bash
npm install
```

This however does not ensure that the libraries and dependencies that are 
relevant to only the server or the client is installed. Instructions for 
installing those can be found in client/README.md and server/README.md. 


## Start the website
Before the website is starded make sure there is an initialzed database. Further 
instructions regarding starting a database can be found in 
server/README.md. 

To start the program run the following command in the root folder:

```bash
npm run dev
```

The program can also be run by using the following command in both /server and /client:

```bash
npm start
```
Observe that the server and client, if the above command is used, has to be run in two 
different terminals.


This will start both the server and the client. To view it in the browser open 
https://localhost:3000



