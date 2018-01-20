const Command = require('command');
const Request = require('request');

module.exports = function AfkHunt(dispatch) {

    const command = Command(dispatch) // 155503 TC EU

    const autoHuntTime = 5; // 5s to Load area data from server


    /**
     *
     *  VARIABLES
     *
     **/

    let bossData = null;
    let nextLocation = null;
    let cid = null;
    let section = null;
    let currentCheckPoint = 0;
    let currentChannel = 0;
    let currentZone = -1;
    let currentBoss = 9050; // Start Boss
    let notifyGuild = false; // Message Guildies when WB found
    let autoHunt = false;
    let autoStop = false; // Stops autohunt when Worldboss found!
    let autoSkip = false; // Skip Channels where Wbs on CD
    let serverId = 0;
    let playerId = 0;
    let playerName = "afk-hunt";
    let mobId = [];
    let openChannel = ['1','2','3','4'];


    /**
     *
     *  FUNCTIONS
     *
     **/

    function nextBoss() {

        let keys = Object.keys(bossData);

        let newIndex = parseInt(keys.indexOf(currentBoss)) + 1;

        console.log("Switching Boss...");

        if (keys.length > newIndex) {

            currentBoss = keys[newIndex]; // Next Boss

        } else {

            currentBoss = keys[0]; // Start first Boss again

        }
        
        console.log(currentBoss);

        currentCheckPoint = 0;
        
        getJSON({cl:'get',fnc:'open'}); // Preload Boss Info
        
        setTimeout( function() { checkNext(); }, 2000);

    }
    
    function checkNext() {
        
        if ((currentChannel >= bossData[currentBoss].channel || currentCheckPoint == 0) && openChannel.length > 0) {

            if (bossData[currentBoss]['checkPoints'].length <= currentCheckPoint) {

                nextBoss();
                return;

            }
            
            nextLocation = bossData[currentBoss]['checkPoints'][currentCheckPoint];

            dispatch.toServer('C_PCBANGINVENTORY_USE_SLOT', 1, { slot : 4 });

            // Initial timeout for Village List
            setTimeout( function() { dispatch.toServer('C_TELEPORT_TO_VILLAGE', 1, { id : bossData[currentBoss].villageId }); }, 800);

            currentCheckPoint++;

            currentChannel = 1; // is worth just for logic
            
            getJSON({cl:'set',fnc:'checked'});

            console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);

            return;

        } else {
 
            currentChannel++;
            
            if (bossData[currentBoss]['checkPoints'].length >= currentCheckPoint && openChannel.length > 0) {

                if (!openChannel.includes(currentChannel.toString())) {
                    checkNext();
                    return;
                }
                
                getJSON({cl:'set',fnc:'checked'});
                
                currentChannel--; 
                
                dispatch.toServer('C_SELECT_CHANNEL', 1, {
                    unk: 1,
                    zone: currentZone,
                    channel: currentChannel,
                });
                
                currentChannel++;
                
                console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);
                
                return;

            }

            nextBoss();
            return;

        }
    
    }
    
    function notify(msg) {
    
        dispatch.toClient("S_CHAT", 1, {channel: 7,authorName: "",message: msg});

        if (notifyGuild) {

            dispatch.toServer('C_CHAT', 1, {channel: 2, message: msg});

        }
    
    }
    
    function getJSON(data) {
    
      let post = Object.assign({
          server: serverId,
          player: playerName,
          player_id: playerId,
          boss: currentBoss,
          channel: currentChannel 
      }, data);
      
      //console.log(post);
    
      Request.post('http://moorleiche.com/worldboss/v2/json.php', {form: post}, function(err, httpResponse, body) {
      
          try {
          
              let response = JSON.parse(body);
              
              if (typeof response.open != 'undefined' && autoSkip) {
                  openChannel = response.open;  
              }
              
              if (typeof response.wb != 'undefined') {
                  bossData = response.wb;  
              }
              
              //console.log(response);
              return;
              
          } catch (e) {
              console.log(body);
          }
  
          return;
      
      });
    
    }
    
    
    /**
     *
     *  HOOKS
     *
     **/
    
    dispatch.hook('S_LOGIN', 7, (event) => {
        
        serverId = event.serverId;
        playerId = event.playerId;
        playerName = event.name;
 
        getJSON({cl:'get',fnc:'wb'});
        
    });

    dispatch.hook('S_LOAD_TOPO', (event) => {
        if (nextLocation != null) {
            Object.assign(event, nextLocation);
            return true;
        }
    });

    dispatch.hook('S_SPAWN_ME', (event) => {
        if (nextLocation != null) {
            Object.assign(event, nextLocation);
            nextLocation = null;
            return true;
        }
    });
    
    dispatch.hook('S_CURRENT_CHANNEL', 1, (event) => {
        currentChannel = event.channel; // 1-4
        currentZone = event.zone;
    });
    
    dispatch.hook('S_VISIT_NEW_SECTION', (event) => {
    
        section = event;
        
        if (!autoHunt) {
        
          for (let key in bossData) {
          
              if (section.mapId + "_" + section.guardId + "_" + section.sectionId == bossData[key].section) {
              
                  getJSON({cl:'set', fnc:'checked', boss:key}); // Todo: Yunaras and Liny same section 
            
              }
          
          }
        
        }
        
        getJSON({cl:'get',fnc:'open'}); // Initial Load boss info
        
        setTimeout(function() {
            if (autoHunt) {
                checkNext();
            }
        }, autoHuntTime * 1000);
        
    });

    dispatch.hook('S_SPAWN_NPC', 3, (event) => {
    
        for (let key in bossData) {
    
            if (event.templateId == key && bossData[key].huntingZoneId.includes(event.huntingZoneId)) {
                
                currentBoss = event.templateId;
                
                mobId.push(event.id.low);
    
                if (autoStop) { autoHunt = false; }
    
                let param = "3#####" + section.mapId + "_" + section.guardId + "_" + section.sectionId + "@" + bossData[event.templateId].zone + "@" + event.x + ","  + event.y + "," + event.z;
    
                let msg = "<FONT>World Boss found! </FONT><FONT FACE=\"$ChatFont\" SIZE=\"18\" COLOR=\"#00E114\" KERNING=\"0\"><ChatLinkAction param=\""+param+"\">&lt;Point of Interest&gt;</ChatLinkAction></FONT><FONT> " + bossData[event.templateId].name + " @ Channel " + currentChannel + "</FONT>";
    
                notify(msg);
    
                getJSON({cl:'set',fnc:'spotted'});
    
            }
        
        }

    });
    
    dispatch.hook('S_DESPAWN_NPC', 1, event => {
        
        if (mobId.includes(event.target.low)) {
        
              let msg = "<FONT>World Boss killed! " + bossData[currentBoss].name + " @ Channel " + currentChannel + "</FONT>";

              notify(msg);
              
              mobId.splice(mobId.indexOf(event.target.low), 1);
              
              getJSON({cl:'set',fnc:'killed'});
              
              return;  

        }
        
    });
    
    
    /**
     *
     *  COMMANDS
     *
     **/
     
    command.add('wb', () => {
        checkNext(); // Trigger to test
    });

    command.add('wbhunt', () => {
        autoHunt = !autoHunt;
        command.message(` Autohunt is now ${autoHunt ? 'enabled' : 'disabled'}.`);
        if (autoHunt) {
            checkNext();
        }
    });
    
    command.add('wbskip', () => {
        autoSkip = !autoSkip;
        command.message(` Autoskip Channel is now ${autoSkip ? 'enabled' : 'disabled'}.`);
    });

    command.add('wbautostop', () => {
        autoStop = !autoStop;
        command.message(` Autostop is now ${autoStop ? 'enabled' : 'disabled'}.`);
    });

    command.add('wbshare', () => {
        notifyGuild = !notifyGuild;
        command.message(` Share with Guild is now ${notifyGuild ? 'enabled' : 'disabled'}.`);
    });

}
