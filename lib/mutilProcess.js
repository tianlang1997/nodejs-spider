import * as cluster from 'cluster'
import * as os from 'os'
import * as fs from 'fs'
// export interface JobInfo {
//     msg: any,
//     handle: Function,
// }
// export interface ProcessOptions {
//     CpuLimit?: number,
//     MemoryLimit?: number,
//     ErrorInterrupt?: boolean
// }
export function MutilProcess(jobs, opts, callback) {
    let cpulimit = os.cpus().length
    if (opts.CpuLimit) {
        cpulimit = cpulimit < opts.CpuLimit ? cpulimit : opts.CpuLimit
    }
    if (cpulimit > 1) {
        let HandleList = {}
        let jobList = jobs.slice()
        for (let i = 0, len = jobList.length; i < len; ++i) {
            if (typeof jobList[i].handle == "function") {
                let fn = "func_" + i
                HandleList[fn] = jobList[i].handle
                jobList[i].handleName = fn
            }
        }
        if (cluster.isMaster) {
            // fs.writeFileSync("master.txt", "")
            // fs.writeFileSync("child.txt", "")
            let index = 0;
            let workerNum = 0;
            let pNum = 0
            let retData = [];
            let errMsg = null;
            for (var i = 0, len = jobList.length; i < cpulimit && index < len; ++i) {
                var worker = cluster.fork();
                worker.send({ pid: worker.process.pid, job: jobList[index] });
                worker.on('message', messageHandler);
                ++index;
                ++workerNum;
            }

            cluster.on('online', function (worker) {
                // console.log('Worker ' + worker.process.pid + ' is online');
            });

            cluster.on('exit', function (worker, code, signal) {
                // console.log('Worker ' + worker.process.pid + ' died with code: ' + code);
                --workerNum;
                if (index < jobList.length && !errMsg) {
                    var worker = cluster.fork();
                    worker.send({ pid: worker.process.pid, job: jobList[index] });
                    worker.on('message', messageHandler);
                    ++index;
                    ++workerNum;
                    // console.log('worker start');
                }
                if (workerNum == 0) {
                    callback(errMsg, retData)
                }

            });

            function messageHandler(this, msg) {
                let worker = this
                pNum++
                if (msg.err) {
                    if (opts.ErrorInterrupt) {
                        errMsg = msg.err
                    } else {
                        retData.push({ err: msg.err })
                    }

                } else {
                    retData.push(msg.child)
                }

                // fs.appendFileSync("master.txt", JSON.stringify(msg) + " : " + pNum + "\n")
                if ((opts.MemoryLimit && msg.heapUsed > opts.MemoryLimit) || index >= jobList.length) {
                    worker.kill();
                    console.log('woker kill')
                } else {
                    worker.send({ pid: worker.process.pid, job: jobList[index] });
                    ++index;
                    // console.log('job start');
                }

            }
        } else {

            process.on('message', function (this, msg) {
                let that = this
                let pid = msg.pid
                let job = msg.job
                let m = job.msg
                // console.log("childmsg----", JSON.stringify(msg))
                if (job.handleName && HandleList[job.handleName]) {
                    HandleList[job.handleName](m, (err, ret) => {
                        // fs.appendFileSync("child.txt", JSON.stringify(ret) + "\n")
                        if (err) {
                            that.send({ "err": err, heapUsed: that.memoryUsage().heapUsed });
                        } else {
                            that.send({ "child": ret, heapUsed: that.memoryUsage().heapUsed });
                        }

                    })
                } else {
                    // fs.appendFileSync("child.txt", retMsg + "\n")
                    that.send({ "child": m, heapUsed: that.memoryUsage().heapUsed });
                }
            });
        }
    } else {
        let index = 0;
        let len = jobs.length;
        let retData = []
        function doJob() {
            if (index >= len) {
                callback(null, retData);
            } else {
                let job = jobs[index++]
                if (typeof job.handle == 'function') {
                    job.handle(job.msg, (err, ret) => {
                        if (err) {
                            if (opts.ErrorInterrupt) {
                                callback(err, retData)
                                return;
                            } else {
                                retData.push({ err: err })
                            }
                        } else {
                            retData.push(ret)
                        }
                        doJob()
                    })
                } else {
                    retData.push(job.msg)
                    doJob()
                }
            }
        }
        doJob()
    }
}

// var charList = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
// var jobList = []

// function doJob(msg, callback) {
//     setTimeout(() => {
//         if (msg == 'f')
//             callback(msg)
//         else
//             callback(null, msg + "0")
//     }, 100)

// }


// for (let i = 0; i < charList.length; ++i) {
//     jobList.push({ msg: charList[i], handle: doJob })
// }

// let t = Date.now()
// MutilProcess(jobList, { MemoryLimit: 40 * 1024 * 1024, CpuLimit: 2, ErrorInterrupt: true }, (err, ret) => {
//     console.log('------------------' + (Date.now() - t) + '---------------------')
//     console.log(err, ret)
// })