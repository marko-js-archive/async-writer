'use strict';
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');
var fs = require('fs');

describe('raptor-render-context' , function() {

    beforeEach(function(done) {
        // for (var k in require.cache) {
        //     if (require.cache.hasOwnProperty(k)) {
        //         delete require.cache[k];
        //     }
        // }

        done();
    });

    it('should render a series of sync calls correctly', function(done) {
        var context = require('../').create();
        context.beginRender();
        context.write('1');
        context.write('2');
        context.write('3');
        context.write('4');
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(output).to.equal('1234');
            done();
        });
    });

    it('should render a series of sync and async calls correctly', function(done) {
        var context = require('../').create();
        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                asyncContext.write('2');
                done();
            }, 200);
        });
        context.write('3');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                asyncContext.write('4');
                done();
            }, 10);
        });
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(output).to.equal('1234');
            done();
        });
    });

    it('should allow an async fragment to complete synchronously', function(done) {
        var context = require('../').create();
        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            asyncContext.write('2');
            done();
        });
        context.write('3');
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(output).to.equal('123');
            done();
        });
    });

    it('should allow the async callback to provide data', function(done) {
        var context = require('../').create();
        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                done(null, 2);
            }, 10);
        });
        context.write('3');
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(output).to.equal('123');
            done();
        });
    });

    it('should handle timeouts correctly', function(done) {
        var context = require('../').create();
        var errors = [];
        context.on('error', function(e) {
            errors.push(e);
        });

        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                done(null, '2');
            }, 200);
        }, 100);
        context.write('3');
        context.endRender();
        
        context.on('end', function() {
            expect(errors.length).to.equal(1);
            expect(context.getOutput()).to.equal('13');
            done();
        });
    });

    it('should render nested async calls correctly', function(done) {
        var context = require('../').create();
        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                asyncContext.write('2a');
                asyncContext.beginAsyncFragment(function(asyncContext, done) {
                    asyncContext.write('2b');
                    done();
                });
                asyncContext.write('2c');
                done();
            }, 30);
        });
        context.write('3');
        context.beginAsyncFragment(function(asyncContext, done) {
            setTimeout(function() {
                asyncContext.beginAsyncFragment(function(asyncContext, done) {
                    asyncContext.write('4a');
                    done();
                });
                asyncContext.beginAsyncFragment(function(asyncContext, done) {
                    asyncContext.write('4b');
                    done();
                });
                asyncContext.write('4c');
                done();
            }, 30);
        });
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(output).to.equal('12a2b2c34a4b4c');
            done();
        });
    });

    it('should handle sync errors correctly', function(done) {
        var context = require('../').create();
        var errors = [];
        context.on('error', function(e) {
            errors.push(e);
        });

        context.beginRender();
        context.write('1');
        context.beginAsyncFragment(function(asyncContext, done) {
            throw new Error('test');
        });
        context.write('3');
        context.endRender();
        context.on('end', function() {
            var output = context.getOutput();
            expect(errors.length).to.equal(1);
            expect(output).to.equal('13');
            done();
        });
    });

    it('should support chaining', function(done) {
        var errors = [];
        var context = require('../').create()
            .on('error', function(e) {
                errors.push(e);
            })
            .on('end', function() {
                var output = context.getOutput();
                expect(errors.length).to.equal(1);
                expect(output).to.equal('13');
                done();
            })
            .beginRender()
            .write('1')
            .beginAsyncFragment(function(asyncContext, done) {
                setTimeout(function() {
                    done(new Error('test'));    
                }, 10);
            })
            .write('3')
            .endRender();
    });

    it('should support writing to a through stream', function(done) {

        var output = '';
        var through = require('through')(
            function write(data) {
                output += data;
            }
        );

        var errors = [];
        require('../').create(through)
            .on('error', function(e) {
                errors.push(e);
            })
            .on('end', function() {
                expect(errors.length).to.equal(0);
                expect(output).to.equal('123');
                done();
            })
            .beginRender()
            .write('1')
            .beginAsyncFragment(function(asyncContext, done) {
                setTimeout(function() {
                    done(null, '2');
                }, 10);
            })
            .write('3')
            .endRender();
    });

    it('should support writing to a file output stream', function(done) {

        var outFile = nodePath.join(__dirname, 'test.out');
        var out = fs.createWriteStream(outFile, 'utf8');

        out.on('close', function() {
            var output  = fs.readFileSync(outFile, 'utf8');
            expect(errors.length).to.equal(0);
            expect(output).to.equal('123');
            fs.unlinkSync(outFile);
            done(); 
        });

        var errors = [];
        require('../').create(out)
            .on('error', function(e) {
                errors.push(e);
            })
            .on('end', function() {
            })
            .beginRender()
            .write('1')
            .beginAsyncFragment(function(asyncContext, done) {
                setTimeout(function() {
                    done(null, '2');
                }, 10);
            })
            .write('3')
            .endRender();
    });
});
