const Command = require('command');
const Request = require('request');

module.exports = function AfkHunt(dispatch) {

    const command = Command(dispatch) // 155503
    
    const lootTime = 90; // 90s to loot until autohunt proceed
    
    const TRIGGER_ITEM = 200930; // http://teradatabase.net/us/item/200930/


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
    let autoHuntTime = 4; // 4s to Load area data from server
    let bossData = [];
    let nextLocation = null;
    let cid = null;
    let section = null;
    let currentCheckPoint = 0;
    let currentChannel = 0;
    let currentZone = -1;
    let currentBoss = -1; // Start Boss Index
    let notifyGuild = false; // Message Guildies when WB found
    let autoHunt = false;
    let autoStop = true; // Stops autohunt when Worldboss found!
    let autoSkip = true; // Skip Channels where Wbs on CD
    let serverId = 0;
    let playerId = 0;
    let playerName = "afk-hunt";
    let mob = 0;
    let openChannel = []; // Nyx Hotfix
    let checkedChannel = []; // Hunt if in Party
    let remoteList = [/*'Jon Doe'*/]; // This Players can remote You and get your notifies
    let remoteListKeyword = 'notjesus'; // Players who whisper this keyword to you, are added to your remote list
    let userStatus = 0;
    let skipBossIndex = [];
    let letMeLoot = null;


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
    
        mob = 0;
        
        checkedChannel = [];
    
        dispatch.toServer('C_PCBANGINVENTORY_USE_SLOT', 1, { slot : 4 });

        // Initial timeout for Village List
        setTimeout( function() { dispatch.toServer('C_TELEPORT_TO_VILLAGE', 1, { id : bossData[currentBoss].villageId }); }, 800);

        currentCheckPoint++;
        
        getJSON({cl:'set',fnc:'checked'});

        console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: ?");
        command.message(" Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: ?"); 

    }
    
    function channel() {
    
        mob = 0;
    
        dispatch.toServer('C_SELECT_CHANNEL', 1, { unk: 1,zone: currentZone,channel: currentChannel - 1 });
                
        getJSON({cl:'set',fnc:'checked'});
                
        console.log("Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);
        command.message(" Check Next: " + bossData[currentBoss].name + ", Checkpoint: " + currentCheckPoint + ", Channel: " + currentChannel);
    
    }
    
    function nextChannel() {
    
        console.log(openChannel.join(", ") + " Open");
        console.log(checkedChannel.join(", ") + " Checked");
    
        /*console.log("Checked Channel:");
        console.log(checkedChannel);
        console.log("Open Channel:");
        console.log(openChannel);
        console.log("My Zone:");
        console.log(currentZone);
        console.log("Boss Zone:");
        console.log(bossData[currentBoss].zone);*/
    
        if (currentZone == bossData[currentBoss].zone) {
        
          for (let key in openChannel) {
            
              if (!checkedChannel.includes(openChannel[key])) {
                
                  currentChannel = parseInt(openChannel[key]);
                    
                  //console.log("Going Channel " + currentChannel + "...");
                    
                  channel();
                    
                  return;
                
              }   
            
          }
        
        }
        
        lastChannel = null;
        
        checkedChannel = [];
        
        nextCheckPoint();
    
    }
    
    function nextCheckPoint() {
    
      if (bossData[currentBoss]['checkPoints'].length > currentCheckPoint) {

          nextLocation = bossData[currentBoss]['checkPoints'][currentCheckPoint];
          
          //console.log("Going Checkpoint " + currentCheckPoint + "...");
    
          teleport();
          
          return;

      }

      nextBoss();
    
    }
     
    function nextBoss() {

        currentBoss++;
        
        console.log("Switching Boss...");
        command.message(" Switching Boss...");
        
        if (skipBossIndex.indexOf(currentBoss) !== -1) {
            nextBoss();
            return;
        }

        if (bossData.length <= currentBoss) {

            currentBoss = 0; // Start first Boss again

        }

        currentCheckPoint = 0;
        
        currentZone = -1;
        
        checkedChannel = [];
        
        openChannel = [];
        
        for (let x = 1; x <= bossData[currentBoss].channel; x++) {
        
            openChannel.push(x.toString()); 
        
        }
        
        getJSON({cl:'get',fnc:'open'}); // Preload Boss Info
        
        setTimeout( function() { checkNext(); }, 2000);

    }
    
    function checkNext() {
    
        clearTimeout(letMeLoot);
        
        let channelString = currentChannel.toString();

        if (!checkedChannel.includes(channelString)) {
        
            checkedChannel.push(channelString);
        
        }
    
        if (currentBoss == -1) {
            // Skip Boss on first Use
            nextBoss();
            return;   
        }
        
        if (openChannel.length == 0) {
            // Skip Boss when no Channel Open
            nextBoss();
            return;    
        }
    
        if (mob != 0  && autoStop) {
            return;
        }
        
        if (userStatus == 1 ) {
            // Wait if in fight 
            setTimeout( function() { checkNext(); }, 5000);
            console.log("In fight...");
            return;       
        }

        wb = 0;

        nextChannel(); 
    
    }
    
    function notify(msg) {
    
        dispatch.toClient("S_CHAT", 1, {channel: 7, authorName: "", message: msg});
        command.message(" " + msg); 
        
        //console.log(remoteList);

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
            
            getJSON({cl:'get',fnc:'open'}); // Initial Load boss info
        
            return true;
        }
    });
    
    dispatch.hook('S_CURRENT_CHANNEL', 1, (event) => {
        
        currentChannel = event.channel; // 1-4

        currentZone = event.zone;
        
        getJSON({cl:'get',fnc:'open'}); // Preload Boss Info
        
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
            
                currentBoss = key;
            
                nextLocation = null;
                
                mob = event.id.low;
                
                //console.log(section);
                //console.log(bossData[key]);
                //console.log(currentChannel);
                
                let param = "3#####" + bossData[key].section + "@" + bossData[key].zone + "@" + event.x + ","  + event.y + "," + event.z;
                
                if (section != null) {
    
                  param = "3#####" + section.mapId + "_" + section.guardId + "_" + section.sectionId + "@" + bossData[key].zone + "@" + event.x + ","  + event.y + "," + event.z;

                }
                
                msg = "<FONT>World Boss found! </FONT><FONT FACE=\"$ChatFont\" SIZE=\"18\" COLOR=\"#00E114\" KERNING=\"0\"><ChatLinkAction param=\""+param+"\">&lt;Point of Interest.&gt;</ChatLinkAction></FONT><FONT> " + bossData[key].name + " @ Channel " + currentChannel + "</FONT>";

                notify(msg);
    
                getJSON({cl:'set',fnc:'spotted',boss:event.templateId});
    
            }
        
        }

    });
    
    dispatch.hook('S_DESPAWN_NPC', 1, (event) => {
        
        if (mob == event.target.low) {
        
              let msg = "<FONT>World Boss killed! " + bossData[currentBoss].name + " @ Channel " + currentChannel + "</FONT>";

              notify(msg);
              
              mob = 0;
              
              getJSON({cl:'set',fnc:'killed'});
              
              if (autoStop && autoHunt) {
                  // Wait until found boss gets killed
                  letMeLoot = setTimeout( function() { checkNext(); }, lootTime * 1000);
                  console.log("You have "+lootTime+"s to loot...");
                  command.message(" You have "+lootTime+"s to loot..."); 
              }
              
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
    
    dispatch.hook('C_USE_ITEM', 1, event => {
  		  if (event.item === TRIGGER_ITEM) {
  			    autoHunt = !autoHunt;
            nextLocation = null;
            command.message(` Autohunt is now ${autoHunt ? 'enabled' : 'disabled'}.`);
            if (autoHunt) {
                checkNext();
            }
            return false;
  		  }
  	});
    

    /**
     *
     *  COMMANDS
     *
     **/
     
    command.add('wb', () => {
        mob = 0; // ignore boss
        checkNext(); // Trigger to test
    });
    
    command.add('wbremote', (name) => {
        addRemotePlayer(name);
        command.message(' ' + name + ' added to remote list.'); 
    });
    
    command.add('wbdata', () => {
        for (let key in bossData) {
            command.message(' ' + key + ' - ' + bossData[key].name); 
        } 
    });
    
    command.add('wbtable', () => {
        dispatch.toClient("S_SHOW_AWESOMIUMWEB_SHOP", 1, {
  			   link: 'http://moorleiche.com/worldboss/v2/ingame.php?server='+serverId+'&player='+playerName+'&player_id=' + playerId
  		  });
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
        
        currentCheckPoint = parseInt(newCheckpoint);
        
        if (bossData.length <= currentBoss) { currentBoss = 0; }

        if (bossData[currentBoss]['checkPoints'].length <= currentCheckPoint) { currentCheckPoint = 0;}
            
        nextLocation = bossData[currentBoss]['checkPoints'][currentCheckPoint];
        
        teleport();
        
    });
    
    command.add('wbskipboss', (index) => {
        if (typeof index == 'undefined') { return; }
        skipBossIndex.push(parseInt(index));
        command.message(' ' + bossData[parseInt(index)]['name'] + ' added to skip list.'); 
    });
    
    command.add('wbtimer', (value) => {
        if (typeof value == 'undefined') { return; }
        autoHuntTime = value;
        command.message(' Next Timer is now ' + value + ' seconds.'); 
    });
    
    command.add('wbreset', () => {
        mob = 0; // ignore boss
        remoteList = [];
        skipBossIndex = [];
        openChannel = [];
        command.message(' default settings restored.'); 
    });

    command.add('wbshare', () => {
        notifyGuild = !notifyGuild;
        command.message(` Share with Guild is now ${notifyGuild ? 'enabled' : 'disabled'}.`);
    });

}
