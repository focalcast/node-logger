angular.module('Log', []).component('logComponent', {
    templateUrl: '/static/templates/log-template.html',
    controller: function(){
        this.getStyle = function(level){
            let color = '#c905f5';
            switch(level){
                case 'debug':
                color = '#0674dc'
                break;
                case 'info':
                color = '#0f9a02';
                break;
                case 'error':
                color = '#bf0202';
                break;
                case 'warn':
                color = '#c5cc05';
                break;
            }
            return {'color': color};
        };
        this.log = [];
        for(let x in log){
            var line = log[x];
            if(line.message.includes('Session:')){
                let message = line.message.split('--');
                let session = message[0].split('Session: ')
                if(session.length > 1){
                    line.message = message[1];
                    line.session = session[1];
                }else{
                    line.session = '';
                }
            }
            this.log.push(line);
        }
        this.sessions = [];
        for(let x in this.log){
            let log = this.log[x];
            if(this.sessions.indexOf(log) === -1){
                this.sessions.push(log.session);
            }
        }
        this.filteredLevels = {
            debug : true,
            info: true,
            warn: true,
            error: true
        };
        this.search = {
            message: ''
        };
        this.filter = (value, index, array)=>{
            if(angular.isUndefined(value)){
                return false;
            }
            if(this.selectedSession !== '' && value.session !== this.selectedSession){
                return false;
            }
            if(!this.filteredLevels[value.level] || !value.message.toLowerCase().includes(this.search.message.toLowerCase())){
                return false;
            }else{
                return true;
            }

        };
        this.selectedSession = '';
    }
});
