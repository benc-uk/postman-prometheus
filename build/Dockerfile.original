FROM node:16-alpine

ARG collectionFile=samples/example.json
ARG srcDir=src

WORKDIR /runner

COPY $srcDir/package*.json ./
RUN npm install --production --silent

COPY $srcDir/*.js ./

COPY ${collectionFile} ./collection.json

CMD [ "node", "server.js" ]
