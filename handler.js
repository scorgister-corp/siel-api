
class Handler {

    #app;

    constructor(app, defaultMethodNotAllowedHandler) {
        this.#app = app;
        this.defaultMethodNotAllowedHandler = defaultMethodNotAllowedHandler;
    }
    
    post(context, handler) {
        this.both(context, this.defaultMethodNotAllowedHandler, handler);
    }
    
    get(context, handler) {
        this.both(context, handler, this.defaultMethodNotAllowedHandler);
    }
    
    both(context, getHandler, postHandler) {
        this.#app.get(context, getHandler);
        this.#app.post(context, postHandler);
    }

    all(context, handler) {
        this.#app.all(context, handler);
    }
}

function createHandler(app, defaultMethodNotAllowedHandler) {
    return new Handler(app, defaultMethodNotAllowedHandler);
}

module.exports = createHandler;