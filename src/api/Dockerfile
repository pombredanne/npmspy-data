FROM mhart/alpine-node:4.7.2

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install --production

ADD . /usr/src/app/

EXPOSE 3001
CMD ["node", "server"]