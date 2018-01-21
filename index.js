const Command = require('command');
const Request = require('request');

module.exports = function AfkHunt(dispatch) {

    const command = Command(dispatch) // 155503

    const autoHuntTime = 5; // 5s to Load area data from server


    /**
     *
     *  VARIABLES
     *
     **/

    let customBossData = [
      /* Add custom boss data for personal use / tests 
      { 
        templateId: '5011',
        name: 'Test Boss',
        channel: 4, // Count of channels
        zone: 7004,
        villageId: 61001, // This Village need to be in same zone
        huntingZoneId: [ 6553604, 13107204 ],
        section: '1_6_56',
        checkPoints: [
          {x:0,y:0,z:0}, // Checkpoints
          {x:0,y:0,z:0},
          {x:0,y:0,z:0}
        ] 
      }*/
    ];
    let bossData = [];
    let nextLocation = null;
    let cid = null;
    let section = null;
    let currentCheckPoint = 0;
    let currentChannel = 0;
    let currentZone = -1;
    let currentBoss = 0; // Start Boss Index
    let notifyGuild = false; // Message Guildies when WB found
    let autoHunt = false;
    let autoStop = true; // Stops autohunt when Worldboss found!
    let autoSkip = false; // Skip Channels where Wbs on CD
    let serverId = 0;
    let playerId = 0;
    let playerName = "afk-hunt";
    let mobId = [];
    let openChannel = ['1','2','3','4'];
    let remoteList = [/*'Jon Doe'*/]; // This Players can remote You and get your notifies
    let remoteListKeyword = 'jesus'; // Players who whisper this keyword to you, are added to your remote list
    let userStatus = 0;


    /**
     *
     *  FUNCTIONS
     *
     **/
     
    function addRemotePlayer(name) {
    
        if (!remoteList.includes(name)) {
        
            remoteList.push(name);  
        
        }
    
    } 
    
    function teleport() {
    
        dispatch.toServer('C_PCBANGINVENTORY_USE_SLOT', 1, { slot : 4 });

        // Initial timeout for Village List
        setTimeout( function() { dispatch.toServer('C_TELEPORT_TO_VILLAGE', 1, { id : bossData[currentBoss].villageId }); }, 800);

        currentCheckPoint++;

        currentChannel = 1; // is worth just for logic
        
        getJSON({cl:'set',fnc:'checked'});

        console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);

    }
    
    function channel() {
    
        dispatch.toServer('C_SELECT_CHANNEL', 1, { unk: 1,zone: currentZone,channel: currentChannel - 1 });
                
        getJSON({cl:'set',fnc:'checked'});
                
        console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);
    
    }
     
    function nextBoss() {

        currentBoss++;

        console.log("Switching Boss...");

        if (bossData.length <= currentBoss) {

            currentBoss = 0; // Start first Boss again

        }

        currentCheckPoint = 0;
        
        getJSON({cl:'get',fnc:'open'}); // Preload Boss Info
        
        setTimeout( function() { checkNext(); }, 2000);

    }
    
    function checkNext() {
    
        if (openChannel.length == 0) {
        
            nextBoss();
            return;    
        
        }
        
        if (userStatus == 1 || (mobId.length != 0 && autoStop)) {
        
            // Wait if in fight or until found boss gets killed
            setTimeout( function() { checkNext(); }, 5000);
            
            console.log("In fight or Boss still here...");
            
            return;       
        
        }
        
        if ((currentChannel >= bossData[currentBoss].channel || currentCheckPoint == 0)) {

            if (bossData[currentBoss]['checkPoints'].length <= currentCheckPoint) {

                nextBoss();
                return;

            }
            
            nextLocation = bossData[currentBoss]['checkPoints'][currentCheckPoint];

            teleport();

            return;

        } else {
 
            currentChannel++;
            
            if (bossData[currentBoss]['checkPoints'].length >= currentCheckPoint) {

                if (!openChannel.includes(currentChannel.toString())) {
                    checkNext();
                    return;
                }

                channel();
                
                return;

            }

            nextBoss();
            return;

        }
    
    }
    
    function notify(msg) {
    
        dispatch.toClient("S_CHAT", 1, {channel: 7, authorName: "", message: msg});
        
        console.log(remoteList);

        for (let key in remoteList) {
        
            dispatch.toServer('C_WHISPER', 1, {target: remoteList[key], message: msg});
        
        } 

        if (notifyGuild) {

            dispatch.toServer('C_CHAT', 1, {channel: 2, message: msg});

        }
    
    }
    
    function getJSON(data) {
    
      let post = Object.assign({
          server: serverId,
          player: playerName,
          player_id: playerId,
          boss: bossData[currentBoss] ? bossData[currentBoss].templateId : 0,
          channel: currentChannel 
      }, data);
    
      Request.post('http://moorleiche.com/worldboss/v2/json.php', {form: post}, function(err, httpResponse, body) {
      
          try {
          
              let response = JSON.parse(body);
              
              if (typeof response.open != 'undefined' && autoSkip) {
              
                  openChannel = response.open;
                    
              }
              
              if (typeof response.wb != 'undefined') {
              
                  bossData = Object.values(response.wb); // Reformat Boss Data to Array
                  bossData = bossData.concat(customBossData); // Add Custom Boss Data

              }

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
     
    dispatch.hook('C_RETURN_TO_LOBBY', 1, () => { if (autoHunt) return false })
    
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
              
                  getJSON({cl:'set', fnc:'checked', boss: bossData[key].templateId}); // Todo: Yunaras and Liny same section 
            
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
    
            if (event.templateId == bossData[key].templateId && bossData[key].huntingZoneId.includes(event.huntingZoneId)) {
            
                nextLocation = null;
                
                mobId.push(event.id.low);
    
                let param = "3#####" + section.mapId + "_" + section.guardId + "_" + section.sectionId + "@" + bossData[key].zone + "@" + event.x + ","  + event.y + "," + event.z;
    
                let msg = "<FONT>World Boss found! </FONT><FONT FACE=\"$ChatFont\" SIZE=\"18\" COLOR=\"#00E114\" KERNING=\"0\"><ChatLinkAction param=\""+param+"\">&lt;Point of Interest&gt;</ChatLinkAction></FONT><FONT> " + bossData[key].name + " @ Channel " + currentChannel + " (wbgo " + key + " " + (currentCheckpoint + 1) + ")</FONT>";
    
                notify(msg);
    
                getJSON({cl:'set',fnc:'spotted',boss:event.templateId});
    
            }
        
        }

    });
    
    dispatch.hook('S_DESPAWN_NPC', 1, (event) => {
        
        if (mobId.includes(event.target.low)) {
        
              let msg = "<FONT>World Boss killed! " + bossData[currentBoss].name + " @ Channel " + currentChannel + "</FONT>";

              notify(msg);
              
              mobId.splice(mobId.indexOf(event.target.low), 1);
              
              getJSON({cl:'set',fnc:'killed'});
              
              return;  

        }
        
    });
    
    dispatch.hook('S_WHISPER', 2, (event) => {
    
        if (event.message.indexOf(remoteListKeyword) !== -1) {
        
            addRemotePlayer(event.authorName);
         
            dispatch.toServer('C_WHISPER', 1, {target: event.authorName, message: 'Welcome to the club!'});
        
        }
        
    });
    
    dispatch.hook('S_USER_STATUS', 1, (event) => {
    
        userStatus = event.status;
        
        if (nextLocation != null && event.status == 1) {
            console.log("Stuck protection");
            nextLocation = null; // Stuck protection 
        }       
        
    });
    
    dispatch.hook('C_CANCEL_SKILL', 1, () => {
    
        if (nextLocation != null) {
            console.log("Stuck protection");
            nextLocation = null; // Stuck protection 
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
    
    command.add('wbremote', (name) => {
        addRemotePlayer(name);
        command.message(' ' + name + ' added to remote list.'); 
    });
    
    command.add('wbclear', (authorName) => {
        remoteList = [];
        command.message(' remote list is empty now.');
    });
    
    command.add('wbdata', () => {
        for (let key in bossData) {
            command.message(' ' + key + ' - ' + bossData[key].name); 
        } 
    });

    command.add('wbhunt', () => {
        autoHunt = !autoHunt;
        nextLocation = null;
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
    
    command.add('wbgo', (newIndex, newCheckpoint) => {
    
        if (typeof newIndex == 'undefined') { newIndex = 0; }
        
        if (typeof newCheckpoint == 'undefined') { newCheckpoint = 0; }
    
        currentBoss = parseInt(newIndex);
        
        currentCheckpoint = parseInt(newCheckpoint);
        
        if (bossData.length <= currentBoss) { currentBoss = 0; }

        if (bossData[currentBoss]['checkPoints'].length <= currentCheckPoint) { currentCheckPoint = 0;}
            
        nextLocation = bossData[currentBoss]['checkPoints'][currentCheckPoint];
        
        teleport();
        
    });

    command.add('wbshare', () => {
        notifyGuild = !notifyGuild;
        command.message(` Share with Guild is now ${notifyGuild ? 'enabled' : 'disabled'}.`);
    });

}
