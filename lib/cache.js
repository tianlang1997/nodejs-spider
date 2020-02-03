var Redis = require('ioredis');
export class Cache {
    constructor(prefix,expire) {
        this.prefix=prefix+":";
        this.expire=expire;
        this.client = new Redis({"host": "127.0.0.1", "port": 6379,"db":0});
    };
    set(key,value,callback){
        if(typeof value === 'object'){
            value = JSON.stringify(value)
        }
        let realkey=this.prefix+key
        this.client.set(realkey,value,callback);
        this.client.expire(realkey,this.expire);
    };
    get(key,callback){
        this.client.set(this.prefix+key,value,callback);
    } 
    
}

export const SpiderCacheInstance=new Cache("spidercache",24*60*60);