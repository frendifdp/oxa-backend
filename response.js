'use strict'

exports.welcome = function (values, res) {
    const data = {
        message: "Welcome to badge",
    };

    
    res.status(200).json(data);
    res.end();
}