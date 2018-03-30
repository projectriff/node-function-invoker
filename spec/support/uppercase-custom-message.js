const { AbstractMessage } = require('@projectriff/message');

class AltMessage extends AbstractMessage {
    constructor(payload) {
        super()
        this.payload = payload;
    }
    toRiffMessage() {
        return {
            headers: {
                'x-test': {
                    values: [
                        'uppercase-custom-message'
                    ]
                }
            },
            payload: this.payload
        };
    }
}

AbstractMessage.fromRiffMessage = function(message) {
    return new AltMessage(message.payload);
};

module.exports = message => {
    if (!(message instanceof AltMessage)) {
        throw new Error('Unexpected message type');
    }
    return new AltMessage(message.payload.toUpperCase());
};
module.exports.$argumentType = 'message';
