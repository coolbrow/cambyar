/* 
 * lesson.js
 *   Render lesson pages
 */
var mongoose = require('mongoose');
var async = require('async');
var models = mongoose.models;

/*
 * Create-lesson GET page
 */
exports.create = function(req, res, next) {
    
    models.Tag.find({}, function(err, tags) {
        if(err) return next(err);
        async.map(tags, function(tag, cb) {
            
            cb(null,"'"+ tag.name+ "'"); 
        }, function(err, results) {
            console.log(results);
            res.render('create-lesson', {
                allTags: results,
            });
        });
    });
    
};


/*
 * POST request for creating a lesson
 *   redirects to '/' on successful DB save
 */
exports.save = function(req, res, next) {
    tags = req.body.tags.split(',');
    async.map(tags, function(tag, cb) {
        var tag_lower = tag.toLowerCase();
        var id;
        models.Tag.findOne({name: tag_lower}, function(err, results) {
            if(!results) {
                var new_tag = new models.Tag({
                    name: tag_lower,
                });
                new_tag.save(function(err) {
                    if(err) cb(err, null);
                    else cb(null,new_tag._id);
                });
            } else {
                cb(null,results._id);
            }
        });
    }, function(err, results) {
        var lesson = new models.Lesson({
            user: req.user._id, 
            description: req.body.desc,
            title: req.body.title,
            subjects: results, 
        });    
        lesson.save(function(err) {
            console.log(JSON.stringify(lesson)); 
            if(err) return next(err);
            res.redirect('/');
        });
        
    });
}


/*
 * GET request on the search page
 */
exports.list = function(req, res, next) {
    models.Lesson.find({}, function(err, lessons) {
        if(err) return next(err);
        res.render('lessons', {
            'lessons': lessons,
        });
    });
}


/*
 * POST request on search query
 *   Only searches through descripton at the moment
 */
exports.search = function(req, res, next) {
    var term = req.body.search_bar;
    var regex = new RegExp(term,'i');
    var results = [];
    models.Lesson.find({description: regex}, function(err, primary) {
        if(err) return next(err);
        results = results.concat(primary);
        async.map(results, function(lesson, cb) {
            cb(null,lesson._id);
        }, function(err, ids) {
            if(err) next(err);
            var terms = term.split(' ');
            regex.compile('('+terms.join('|')+')','i');
            models.Lesson.find({description: regex, _id: {$nin: ids}}, function(err,secondary) {
                if(err) return next(err);
                results = results.concat(secondary);
                res.render('lessons', {
                    'lessons': results,
                });
            });
        });
    });
}


/*
 * GET request on a lesson page
 */
exports.page = function(req, res, next) {
    models.Lesson.findById(req.params.id, function(err, lesson) {
        if(err) {
            if(err.message !== 'Invalid ObjectId') return next(err);
        }
        /* No lesson by that id exists */
        if(!lesson) {
            return res.send('<strong>Hey this isn\' a page</strong>',404);
        } else {
            models.User.findById(lesson.user, function(err, user) {
                if(err) return next(err);
                if(!user) {
                    return;
                } //some serious shit went down
                lesson.author = user;
                res.render('lesson', {
                    'lesson': lesson,
                });

            }); 
        }
    });
}


/*
 * GET request for the 'Request a Lesson' page
 */
exports.requestForm = function(req, res, next) {
    models.Lesson.findById(req.query.l, function(err, lesson) {
        if(err) {
            if(err.message !== 'Invalid ObjectId') return next(err);
        }
        if(!lesson) res.send('Nothing here. Move Along', 404);
        models.User.findById(lesson.user, function(err, user) {
            if(err) return next(err);
            if(!user) return; //render something later?

            res.render('send-request', {
                'teacher': user,
                'lesson': lesson,
            });
        });
    });   
}


/*
 * POST request for sending the Lesson Request form
 */
exports.sendRequest = function(req, res, next) {
    console.log(req.query.l);
    models.Lesson.findById(req.query.l, function(err, lesson) {
        if(err) { 
            if(err.message !== 'Invalid ObjectId') return next(err);
        } 
        if(!lesson) res.send('Nothing here', 404);
        
        var request = new models.Request({
            from: req.user._id,
            to: lesson.user,
            message: req.body.message,
            lesson: lesson._id,
        });
       
        request.save(function(err) {
            if(err) return next(err);
            console.log(JSON.stringify(request));
            res.redirect('/lessons/'+lesson._id);
        });
    });

}

/*
 * GET request on the rating page
 */
exports.rate = function(req, res, next) {
    models.Lesson.findById(req.query.l, function(err, lesson) {
        if(err) {
            if(err.message !== 'Invalid ObjectId') return next(err)
        }
        if(!lesson) res.send('Nothing here', 404);
        models.User.findById(lesson.user, function(err, user) {
            if(err) {
                if(err.message !== 'Invalid ObjectId') return next(err)
            }
            if(!user) res.send('Something\'s broken', 500);
            res.render('rate', {
                'lesson': lesson,
                'teacher': user,
            });
        });
    });
}

exports.sendRating = function(req, res, next) {
     models.Lesson.findById(req.query.l, function(err, lesson) {
        console.log(lesson)
        if(err) {
            if(err.message !== 'Invalid ObjectId') return next(err)
        }
        if(!lesson) res.send('Nothing here', 404);
        models.User.findById(lesson.user, function(err, user) {

            console.log(user);
            if(err) {
                if(err.message !== 'Invalid ObjectId') return next(err)
            }
            if(!user) return res.send('Something\'s broken', 500);
            models.Request.find({
                to: user._id,
                from: req.user._id,
                lesson: lesson._id,
                status: 'complete',
            }, function(err, requests) {
                if(err) return next(err);
                console.log(requests);
                if(requests.length < 1) return res.send('You can\'t do this', 404)
                models.Rating.update({
                    user: user._id, 
                    rater: req.user._id, 
                    lesson: lesson._id, 
                }, {value: req.body.scale}, {upsert: true}, function(err, rating) {
                    if(err) return next(err);
                    console.log('logging: '+rating);
                    res.redirect('/');
                });
            });

        });
    });
}
