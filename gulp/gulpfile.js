var gulp = require('gulp-param')(require('gulp'), process.argv);
var _ = require('underscore');
var chug = require('gulp-chug');
var inject = require('gulp-inject');
var gutil = require('gulp-util');
var GulpDocker = require('gulp-docker');
var minimist = require('minimist');
var shell = require('gulp-shell');
var runSequence = require('gulp-run-sequence');
var gulpFunction = require('gulp-function');
var prompt = require('gulp-prompt');

var _image = 'node';
var _project = 'focalcast';
var _tag;
var environment;

var cc = function(thing){
    return JSON.parse(JSON.stringify(thing));
};

var createDocker = function(containers){
    new GulpDocker(gulp, containers);
};

var containers = function(tag){
    return {
        node : {
            tags : cc(tag),
            name : 'node',
            directory : '../',
            dockerfile : '../',
            repo : 'focalcast/node'
        },
    };
};



var deploymentEnv = {
    dev : 'development',
    stag : 'staging',
    prod : 'production',
    devprem : 'development-onpremise',
};

var region = {
    west : 'us-west-2',
    east : 'us-east-1'
};
var repo = {
    west : '308164914226.dkr.ecr.us-west-2.amazonaws.com',
    east : '308164914226.dkr.ecr.us-east-1.amazonaws.com',
};



var pushToAws = function(){
    if(!_project){
        _project = 'focalcast';
    }

    if(!_image)
        gutil.PluginError('aws', 'No image specified');
    if(!_tag)
        gutil.PluginError('aws', 'Not tag specified');

    var taggedImage = _project+'/'+_image+':'+_tag;
    var repoTaggedImage = repo+'/'+taggedImage;


    var worker =  gulp.src('', {read : false}).
        pipe(prompt.prompt({
            type: 'checkbox',
            name: 'region',
            choices: ['west', 'east'],
        default: 'west2'
        }, function(res){
            var _region = region[res.region];
            var makeRepoTaggedImage = function(_region){
                var _repo=repo[_region];
                return _repo+'/'+taggedImage;
            };
            worker.pipe(
                shell(
                    [
                        'aws ecr get-login --region ' + _region + ' | pbcopy;',
                        'pbpaste;',
                        'docker tag ' + taggedImage + ' ' + makeRepoTaggedImage(_region) + ';',
                        'docker push ' +  repoTaggedImage + ';'
                    ],
                    {
                        interactive:true, 
                        verbose: true,
                    }
                )
            );
        }));
        return worker;
};

gulp.task('compose-up', function(){
    return gulp.src('*').pipe(prompt.confirm({
        message : 'Compose up?',
    default: true
    })).pipe(shell('docker-compose up -d'));
});

gulp.task('push-to-aws', function(){
    gulp.src('').pipe(prompt.confirm({
        message: 'Continue?',
    default: true})).
        pipe(gulpFunction(pushToAws));
});

gulp.task('get-repo', function(region){
    if(region){
        return gulp.src('').pipe(shell( "echo '" + repo[region] + "'| tr -d '\n' | pbcopy"));
    }
});
gulp.task('build', function(tag){
    var callback = function(){
        var buildImage = function(){
            runSequence('docker:image', 'push-to-aws');
        };
        buildImage();
    };

    try{
        if(!tag){
            throw 'Image tag undefined';
        }else{
            _tag = tag;
        }
        var _environment = _.invert(deploymentEnv)[tag];

        if(typeof _environment === 'undefined'){
            throw 'Tag not found';
        }
        gutil.log('tag', tag, 'image', _image);
        var tags = [];
        process.env.FOCALCAST_DEPLOYMENT = process.env.FC_ENV = tag;
        tags.push(tag);

        if(_environment.includes('onpremise')){
            tags = [];
            tags.push('development-onpremise');
        }
        gutil.log('making container');
        var c = containers(tags);
        gutil.log('c is made');
        var container = {};
        container[_image] = c[_image];

        gutil.log('here');
        createDocker(container);

        var isProduction = _.indexOf(tags, 'production');
        if(isProduction !== -1){

            var confirmation = 'I am not a total fuckup';

            var verifyCallback = function(res){
                gulp.task('build-javascript', callback);
                return runSequence('build-javascript');
            };

            verifyConfirm(confirmation, verifyCallback);
        }
        else{

            gulp.task('build-javascript', callback);
            return runSequence('build-javascript');
        }
    }catch(err){
        gutil.log(err);
        throw 'Image not found in list of known repositories';
    }
});


