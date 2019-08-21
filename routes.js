'use strict'

module.exports = function(app){
    const controller = require('./controller');
    const response = require('./response');

    const auth = require('./authorization');

    const admin = (req, res, next) => {
        try {
            const token = req.headers.authorization;
            if(token != 'admin'){
                return res.status(401).json({
                    message: 'auth failed'
                });
            } else {
                next();
            }
        } catch (error) {
            return res.status(401).json({
                message: 'auth failed'
            });
        }
    }


    //API
    app.get('/', response.welcome);
    app.get('/api/v2/users', controller.getUser);
    app.get('/api/v2/user/:id', controller.getUser);
    app.post('/api/v2/login', controller.login);
    // app.post('/api/v2/logout',);
    app.post('/api/v2/register', controller.register);

    app.post('/api/v2/upgrade_badge', auth, controller.upgradeBadge);
    app.patch('/api/v2/add_exp', auth, controller.addExp);

    // //LEVEL
    app.get('/api/v3/level', admin, controller.getLevel);
    app.post('/api/v3/level', admin, controller.addLevel);
    app.put('/api/v3/level/:id', admin, controller.updateLevel);
    app.delete('/api/v3/level/:id', admin, controller.deleteLevel);

    // //BADGE
    app.get('/api/v3/badge', admin, controller.getBadge);
    app.post('/api/v3/badge', admin, controller.addBadge);
    app.put('/api/v3/badge/:id', admin, controller.updateBadge);
    app.delete('/api/v3/badge/:id', admin, controller.deleteBadge);
}