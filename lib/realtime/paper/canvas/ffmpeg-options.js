const AUDIO = [
    '-f', 'webm',
    '-i', 'pipe:4',
    '-c:a', 'libvorbis',
    '-ar', '44100',
    '-f', 'webm',
    'whatthefuck.webm'
];
module.exports.AUDIO =AUDIO;
const PNG2FLV = [
    //
    // '-i', 'pipe:4',
    // '-c:a', 'vorbis',
    // '-vn',
    '-f', 'png_pipe',
    '-vcodec', 'png',
    '-video_size', '960x540',
    // '-frame_drop_threshold', '1.0',
    //Variable framerate
    '-vsync', '1',
    '-re',
    '-framerate', '15',
    '-i', '-',
    '-framerate', '15',
    '-an',
    // '-vstats_file', this.filename('log'),
    // '-use_wallclock_as_timestamps', '1',
    '-s', '960x540',
    //i-frames interval
    '-g', '15',
    //b-frames
    '-bf', '3',
    //Very fast b-frame strategy
    // '-b_strategy', '0',
    '-c:v', 'libx264',
    '-bufsize', '2000k',
    '-maxrate', '1000k',
    '-probesize', '2500',
    '-preset', 'ultrafast',
    //zerolatency setting for libx264
    '-tune', 'zerolatency',
    // '-profile:v', 'baseline', '-level', '-3.0'
    '-x264opts', 'keyint=10:min-keyint=10:no-scenecut:bframes=5:nal-hrd=cbr:force-cfr=0',
    '-threads', '0',
    // '-use_wallclock_as_timestamps', '1',
    '-copyts',
    // '-framerate', '9',
    '-copytb', '1',
    // '-fflags', 'nobuffer',
    '-pix_fmt', 'yuv420p',
    '-f', 'flv',
    '-movflags', '+faststart',
    '-r', '30'
];
const FLV2RTMP = [
    '-f', 'flv',
    '-vsync', '1',
    '-re',
    '-i', '-',
    '-use_wallclock_as_timestamps', '1',
    '-vcodec', 'copy',
    '-f', 'flv',
    '-y',
];
var txt2mp4 = (source) => {
    return [
        '-loglevel', 'debug',
        '-report',
        '-f', 'concat',
        '-safe', 0,
        '-i', source,
        '-pix_fmt', 'yuv420p',
        '-f', 'mp4'
    ];
}
module.exports.PNG2FLV = PNG2FLV;
module.exports.FLV2RTMP = FLV2RTMP;
module.exports.txt2mp4 = txt2mp4;
