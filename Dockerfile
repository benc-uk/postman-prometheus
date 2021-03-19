FROM node:14-alpine

ARG collectionFile

COPY package*.json ./
RUN npm install --production --silent

WORKDIR /runner
COPY *.js ./

COPY ${collectionFile} ./collection.json

CMD [ "node", "server.js" ]
