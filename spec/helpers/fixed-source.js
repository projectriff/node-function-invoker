const {Readable} = require('stream');
const {min} = Math;

module.exports = class FixedSource extends Readable {

    constructor(values) {
        super({objectMode: true});
        this.values = values;
        this.length = this.values.length;
        this._index = 0;
    }

    _read(size) {
        if (this._index < this.length) {
            const end = min(this._index + size, this.length);
            for (let i = this._index; i < end; i++) {
                this.push(this.values[i]);
            }
            this._index += end;
        } else {
            this.push(null)
        }
    }
};
