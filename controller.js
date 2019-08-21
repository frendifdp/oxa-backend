'use strict'
require('dotenv').config();
const conn = require('./connect');
const response = require('./response');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');
const algorithm = process.env.ENC_ALGORITHM;
const password = process.env.ENC_PASS;

function encrypt(text) {
    var cipher = crypto.createCipher(algorithm, password);
    var crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
}

const ssql = `SELECT u.id as id, u.name as name, u.nickname as nickname, u.exp as exp, u.total_check_in as total_check_in, 
u.last_check_in as last_check_in, l.id as id_level, l.level as level, b.id as id_badge, b.badge as badge FROM user as u 
INNER JOIN level as l ON(u.id_level = l.id) INNER JOIN badge as b ON(u.id_badge = b.id)`
exports.tes = function (req, res) {
    response.ok('Welcome!', res);
}

function today() {
    let day = new Date();
    let dd = day.getDate();
    let mm = day.getMonth() + 1; //January is 0!

    let yyyy = day.getFullYear();
    if (dd < 10) {
        dd = '0' + dd;
    }
    if (mm < 10) {
        mm = '0' + mm;
    }
    return dd + '/' + mm + '/' + yyyy;
}
//API V2
exports.getUser = function (req, res) {
    let id = req.params.id || 0;
    let sql = ssql;
    if (id != 0) {
        sql = sql + ` WHERE u.id=${id}`;
    }
    conn.query(sql, function (err, rows) {
        if (err) {
            return res.status(500).send(err)
        }
        if (rows.length > 0) {
            res.status(200).json(rows)
        } else {
            res.status(203).json({
                message: 'user not found',
                id: id,
            })
        }
    })
}

exports.register = function (req, res) {
    let username = req.body.username || '';
    let nickname = req.body.username || username;
    let password = req.body.password || '';
    let data = {};
    let code = 0;
    if (username == '') {
        data.message = 'username can\'t be empty';
        return res.status(403).json(data);
    } else if (password == '') {
        data.message = 'password can\'t be empty';
        return res.status(403).json(data);
    } else {
        let encrypted = encrypt(password);
        let sql = `INSERT INTO user SET name='${username}', nickname='${nickname}', password='${encrypted}'`;
        conn.query(sql, function (err, rows) {
            if (err) {
                data.message = 'username has been taken';
                code = 403;
            } else {
                data.message = 'user registered';
                code = 200
            }
            return res.status(code).json(data);
        })
    }
}

exports.login = function (req, res) {
    let username = req.body.username || '';
    let password = req.body.password || '';
    if (username == '' && password == '') {
        return res.status(403).send({
            message: `username & password can't be empty`
        })
    } else if (username == '') {
        return res.status(403).send({
            message: `username can't be empty`
        })
    } else if (password == '') {
        return res.status(403).send({
            message: `password can't be empty`
        })
    } else {
        let encrypted = encrypt(password)
        let sql = ssql + ` WHERE u.name='${username}' && u.password='${encrypted}'`;
        conn.query(sql, function (err, rows) {
            if (rows.length == 1) {
                let check_in = `UPDATE user SET last_check_in='${today()}'`
                if (today() != rows[0].last_check_in) {
                    check_in = check_in + `, total_check_in=total_check_in+1`;
                    rows[0].total_check_in = Number(rows[0].total_check_in) + 1
                }
                check_in = check_in + ` WHERE id=${rows[0].id}`
                conn.query(check_in, function (err) {
                    rows[0].total_check_in = Number(rows[0].total_check_in)
                    rows[0].last_check_in = today()
                    const token = jwt.sign({
                        rows
                    }, process.env.JWT_KEY, {
                        expiresIn: '24h'
                    });
                    return res.status(200).send({
                        message: 'login success',
                        data: rows,
                        token: token,
                        date: today()
                    })
                })
            } else {
                return res.status(403).send({
                    message: 'incorrect username or password',
                })
            }
        })
    }
}

exports.addExp = function (req, res) {
    let exp = req.body.exp || 0;
    let id = req.userData.id;

    let updateStat = ssql + ` WHERE u.id='${id}'`;
    conn.query(updateStat, function (err, rows) {
        let id_level = rows[0].id_level;
        let userExp = Number(rows[0].exp) + exp;
        let checkSql = `SELECT * FROM level WHERE min_exp>=${userExp} ORDER BY level ASC LIMIT 1`;
        conn.query(checkSql, function (err, rows) {
            let data = {
                currentExp: userExp,
            }
            let sql = `UPDATE user SET exp=exp+${exp}`
            let lvSql = '';
            if (rows.length != 0 && id_level != rows[0].id && userExp == rows[0].min_exp) {
                id_level = rows[0].id;
                lvSql = sql + `, id_level='${id_level}' WHERE id='${id}'`;
                data.message = 'you levelled up';
            } else if (rows.length == 0) {
                data.currentExp = userExp - exp;
                data.message = 'you have reach max level';
                exp = 0;
            } else {
                lvSql = sql + ` WHERE id='${id}'`;
                data.message = 'need more exp to level up';
            }
            if (exp > 0) {
                conn.query(lvSql, function (err) {})
            }
            return res.status(200).json(data);
        })
    })
}

exports.upgradeBadge = function (req, res) {
    let upgrade = req.body.upgrade || 'no';
    if (upgrade == 'ok') {
        let id = req.userData.id;
        let updateStat = ssql + ` WHERE u.id='${id}'`;
        conn.query(updateStat, function (err, rows) {
            let level = rows[0].level;
            let currentBadge = rows[0].id_badge;
            let badge = rows[0].badge;
            let checkIn = Number(rows[0].total_check_in);
            let checkSql = `SELECT * FROM badge WHERE min_level<='${level}' AND min_check_in<='${checkIn}' ORDER BY id DESC LIMIT 1`;
            conn.query(checkSql, function (err, rows) {
                let data = {};
                if (rows.length > 0 && currentBadge != rows[0].id) {
                    let sql = `UPDATE user SET id_badge='${rows[0].id}' WHERE id='${id}'`;
                    data.message = `upgrade badge successfull`;
                    data.badge = rows[0].badge
                    conn.query(sql, function (err) {})
                } else {
                    data.message = 'your current level or check in is not enough';
                    data.badge = badge
                }
                return res.status(200).json(data);
            })
        })
    } else {
        return res.status(403).send({
            message: 'request rejected'
        });
    }
}

//V3 LEVEL

exports.getLevel = function (req, res) {
    conn.query(`SELECT * FROM level`, function (err, rows) {
        if (err) {
            return res.status(403).send(err);
        } else {
            return res.status(200).send({
                data: rows
            });
        }
    })
}

exports.addLevel = function (req, res) {
    let level = req.body.level || 0;
    let minExp = req.body.min_exp || 0;
    if (level == 0) {
        return res.status(403).send({
            message: 'level can\'t be empty'
        })
    } else if (minExp == 0) {
        return res.status(403).send({
            message: 'min_exp can\'t be empty'
        })
    } else {
        let sql = `INSERT INTO level SET level=${level}, min_exp='${minExp}'`;
        conn.query(sql, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: 'new level added'
                });
            }
        });
    }
}

exports.updateLevel = function (req, res) {
    let level = req.body.level || 0;
    let minExp = req.body.min_exp || 0;
    let id = req.params.id || 0;
    if (level == 0) {
        return res.status(403).send({
            message: 'level can\'t be empty'
        })
    } else if (minExp == 0) {
        return res.status(403).send({
            message: 'min_exp can\'t be empty'
        })
    } else if (id == 0) {
        return res.status(403).send({
            message: 'param id can\'t be empty'
        })
    } else {
        let sql = `UPDATE level SET level=${level}, min_exp='${minExp}' WHERE id='${id}'`;
        conn.query(sql, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: 'level updated'
                });
            }
        });
    }
}

exports.deleteLevel = function (req, res) {
    let id = req.params.id || 0
    if (id == 0) {
        return res.status(403).send({
            message: 'param id can\'t be empty'
        })
    } else {
        conn.query(`DELETE level WHERE id='${id}'`, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: `level deleted`
                });
            }
        })
    }
}

//V3 BADGE

exports.getBadge = function (req, res) {
    conn.query(`SELECT * FROM badge`, function (err, rows) {
        if (err) {
            return res.status(403).send(err);
        } else {
            return res.status(200).send({
                data: rows
            });
        }
    })
}

exports.addBadge = function (req, res) {
    let minLevel = req.body.min_level || 0;
    let min_check_in = req.body.min_check_in || 0;
    let badge = req.body.badge || 0;
    if (minLevel == 0) {
        return res.status(403).send({
            message: 'min_level can\'t be empty'
        })
    } else if (min_check_in == 0) {
        return res.status(403).send({
            message: 'min_check_in can\'t be empty'
        })
    } else if (badge == 0) {
        return res.status(403).send({
            message: 'badge can\'t be empty'
        })
    } else {
        let sql = `INSERT INTO badge SET badge='${badge}', min_level='${min_level}', min_check_in='${min_check_in}'`;
        conn.query(sql, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: 'new badge added'
                });
            }
        });
    }
}

exports.updateBadge = function (req, res) {
    let minLevel = req.body.min_level || 0;
    let min_check_in = req.body.min_check_in || 0;
    let badge = req.body.badge || 0;
    let id = req.params.id || 0;
    if (minLevel == 0) {
        return res.status(403).send({
            message: 'min_level can\'t be empty'
        })
    } else if (min_check_in == 0) {
        return res.status(403).send({
            message: 'min_check_in can\'t be empty'
        })
    } else if (badge == 0) {
        return res.status(403).send({
            message: 'badge can\'t be empty'
        })
    } else if (id == 0) {
        return res.status(403).send({
            message: 'param id can\'t be empty'
        })
    } else {
        let sql = `UPDATE badge SET badge='${badge}', min_level='${min_level}', min_check_in='${min_check_in}' WHERE id='${id}'`;
        conn.query(sql, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: 'badge updated'
                });
            }
        });
    }
}

exports.deleteBadge = function (req, res) {
    let id = req.params.id || 0
    if (id == 0) {
        return res.status(403).send({
            message: 'param id can\'t be empty'
        })
    } else {
        conn.query(`DELETE badge WHERE id='${id}'`, function (err) {
            if (err) {
                return res.status(403).send(err);
            } else {
                return res.status(200).send({
                    message: `badge deleted`
                });
            }
        })
    }
}