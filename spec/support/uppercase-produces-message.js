const { Message } = require('@projectriff/message');

module.exports = message => {
    console.log('message', message);
    return Message.builder()
        .addHeader('X-Test', 'uppercase-produces-message')
        .payload(message.toUpperCase())
        .build();
};
