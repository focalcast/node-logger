var Paths = function(){
};

Paths.prototype.submit = function(socket, session, message){
    io.sockets.in(session.roomname).emit('whiteboard_action', message);


};


module.exports = Paths;
