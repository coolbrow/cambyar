/*
 * request.js
 *   Reqest routes
 */
var async = require('async');
var models = require('../lib/models');
var utils = require('../lib/utils');

/*
 * GET request on current request for user
 */
exports.list = function(req, res, next) {
    models.Request.find({to: req.user._id, status: 'pending'}, function(err, pending) {
        if (err) return next(err);
        models.Request.find({to: req.user._id, status: 'in_session'}, function(err, sessions) {
            if (err) return next(err);
            async.map(pending, function(request, cb) {
                models.User.findOne({_id: request.from}, function(err, user) {
                    if(err) return cb(err, null);
                    request.sender = user;
                    cb(null, request);
                });
            }, function(err, pendings) {
                if(err) return next(err);
                async.map(sessions, function(session, cb) {
                    models.User.findOne({_id: session.from}, function(err, user) {
                        if(err) return cb(err, null);
                        session.sender = user;
                        cb(null, session);
                    });
                }, function(err, sessions) {
                    if(err) return next(err);
                    res.render('requests', {
                        'in_session': sessions,
                        'pending': pendings,
                    });
                });
            });
        });
    });
}


/*
 * GET request on request action
 */
exports.action = function(req, res, next) {
    switch (req.query.a) {
    case 'accept':
        accept(req, res, next);
        break;
    case 'remove':
        remove(req, res, next);
        break;
    case 'complete':
        complete(req, res, next);
        break;
    case 'stale':
        stale(req, res, next);
        break;
    default:
        res.redirect('/requests');
    }
}

/*
 * Remove request
 */
function remove(req, res, next) {
    models.Request.remove({_id: req.query.r, to: req.user._id}, function(err) {
        if (err) return next(err);
        res.redirect('/requests');
    });
}

/*
 * Accept request
 */
function accept(req, res, next) {
    models.Request.update({_id: req.query.r, to: req.user._id, status: 'pending'}, {
        status: 'in_session',
    }, function(err) {
        if (err) return next(err);
        res.redirect('/requests');
    });
}

/*
 * Complete request
 */
function complete(req, res, next) {
    models.Request.findOne({
        _id: req.query.r, 
        to: req.user._id, 
        status: 'in_session'
    }, function(err, request) {
        if (err) return next(err);
        if (!request) return res.redirect('back');
        request.status = 'complete';
        request.save(function(err) {
            if (err) return next(err);
            models.User.findOne({_id: request.from, alerts: true}, function(err, user) {
                if (err) return next(err);
                if (user) {
                    utils.sendEmail(user.email, './public/email/rate.txt',{
                        subject: 'Please Rate',
                        username: user.username,
                        rate_url: 'localhost:3000/lesson/rate?l='+request.lesson,
                        edit_url: 'localhost:3000/edit-profile'
                    });
                }
                res.redirect('back');
            });
        });
    });
}

/*
 * State request
 */
function stale(req, res, next) {
    models.Request.update({_id: req.query.r, to: req.user._id, status: 'in_session'}, {
        status: 'stale',
    }, function(err) {
        if (err) return next(err);
        res.redirect('/requests');
    });
}

exports.requestedLessons = function(req, res, next) {
    models.Request.find({from: req.user._id}, function(err, requests) {
        if (err) return next(err);
        async.map(requests, function(request, cb) {
            cb(null, request.lesson);
        }, function(err, request_ids) {
            models.Lesson.find({_id: {$in: request_ids}}, function(err, lessons) {
                if(err) return next(err);
                res.render('sent-requests', {
                    lessons: lessons
                });
            });
        });
    });
}
