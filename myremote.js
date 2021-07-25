// CONFIGURABLE CONSTANTS

const DEBUG = false;
const REMOTE_KEY_MAPPINGS = './remotes/default.json'
const INPUT_DEVICE_FILE = '/dev/input/event0';

const VOL_BIG_INCR = 10;
const VOL_SMALL_INCR = 5;
const SKIP_STEP_IN_SECS = 10;

// CODE

const MPD = require('mpd');
const InputEvent = require('input-event');

const input = new InputEvent(INPUT_DEVICE_FILE);
const remote = new InputEvent.Keyboard(input);
const mpdcmd = MPD.cmd;

const KEYDOWN = 'keydown';
const KEYPRESS = 'keypress';
const KEYUP = 'keyup';

const MPDCMD_STOP = 'stop';
const MPDCMD_PLAY = 'play';
const MPDCMD_STATUS = 'status';
const MPDCMD_PAUSE = 'pause';
const MPDCMD_PREVIOUS = 'previous';
const MPDCMD_NEXT = 'next';
const MPDCMD_SETVOL = 'setvol';
const MPDCMD_SEEKCUR = "seekcur";


const codes = require(REMOTE_KEY_MAPPINGS);
let commands = {};
commands[ KEYPRESS + codes.STOP ]        = () => sendcmd(MPDCMD_STOP);
commands[ KEYPRESS + codes.PLAY ]        = () => sendcmd(MPDCMD_PLAY);
commands[ KEYPRESS + codes.VOLUME_DOWN ] = incvol(-1 * VOL_BIG_INCR) ;
commands[ KEYPRESS + codes.VOLUME_UP ]   = incvol(VOL_BIG_INCR) ;
commands[ KEYDOWN + codes.VOLUME_DOWN ]  = incvol(-1 * VOL_SMALL_INCR) ;
commands[ KEYDOWN + codes.VOLUME_UP ]    = incvol(VOL_SMALL_INCR) ;
commands[ KEYPRESS + codes.MUTE ]        = mute();
commands[ KEYDOWN + codes.PREVIOUS ]     = seek(-1 * SKIP_STEP_IN_SECS);
commands[ KEYDOWN + codes.NEXT ]         = seek(SKIP_STEP_IN_SECS);
commands[ KEYUP + codes.PREVIOUS ]       = seek(MPDCMD_PREVIOUS);
commands[ KEYUP + codes.NEXT ]           = seek(MPDCMD_NEXT); 


let mpdstatus = {};
let namebycode = {};
Object.keys( codes ).forEach( key => namebycode[ codes[key] ] = key );


const mpd = MPD.connect({
  port: 6601,
  host: 'pine64.home',
});

function logmsg(level,msg){
    console.log(`${new Date().toISOString()} - ${level} - ${msg}`);
}


function logdebug(msg){
    if(DEBUG){
        logmsg( "[DEBUG]" , msg);
    }
}

function log(msg){
    logmsg( " [INFO]" , msg);
}

function sendcmd(cmd, args){
    let params = [];
    if( args ){ params = args }
    const logfunc = ( cmd === MPDCMD_STATUS ? logdebug : log );
    logfunc( " [SEND]: " + cmd + " " + params );
    mpd.sendCommand(mpdcmd(cmd, params), function(err, msg) {
        if (err) { console.log(err); return } 
        const status = MPD.parseKeyValueMessage(msg);
        mpdstatus = ( status ? status : mpdstatus );
        logdebug(JSON.stringify(mpdstatus)) ;
    });
}

function mute(){
    let mutedvol = 0;
    return () => {
        const storedvol = mpdstatus.volume;
        sendcmd( MPDCMD_SETVOL, [ mutedvol ]);
        mutedvol = storedvol;
    }
}


function incvol( volume ){
    return () => {
        const vol = parseInt( mpdstatus.volume ) + volume;
        if( vol >=0 && vol <= 100 ) { 
            mpdstatus.volume = vol;
            sendcmd(MPDCMD_SETVOL, [ mpdstatus.volume ]);
        }
    }
}

function seek( pos ){
    skipped = false;
    return () => { 
        if( pos === MPDCMD_NEXT || pos === MPDCMD_PREVIOUS ){
            if(  !skipped  ) sendcmd(pos);
            skipped = false; 
        }
        if( typeof pos === "number"){
            skipped = true; 
            sendcmd( MPDCMD_SEEKCUR, [ ( pos > 0 ? "+" : "-" ) + pos ] )
        }
    };

}

function get_keyhandler( evid ){
    return evdata => {
        log(`[INPUT]: ${evid} : ${ namebycode[ evdata.code] }`);
        const cmd = commands[ evid + evdata.code ];
        if( cmd ){
            cmd()
        }
    }
}

mpd.on('ready', function() {
  sendcmd( MPDCMD_STATUS );
  log("ready");
  [ KEYUP, KEYDOWN, KEYPRESS ].forEach( evid => {
	remote.on( evid , get_keyhandler( evid ) ); 
  });

});

function statusupdate( param ){
    logdebug(`[MPD] system: ${(param?param:" - ")}`);
    sendcmd( MPDCMD_STATUS );  
}

mpd.on('system', statusupdate );
mpd.on('system-player', statusupdate );




