const { Message } = require('@projectriff/message');

Message.install();

module.exports = message => {
    if (!(message instanceof Message)) {
        throw new Error('Unknown message type');
    }
    return message.payload.toUpperCase();
};
module.exports.$argumentType = 'message';
