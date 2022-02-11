let NATION_COLORS = {}
let NATION_COLORS_FLAT = []

function recalculateNationColors() {
  NATION_COLORS = {}
  for (let meganation of NATION_COLORS_FLAT) {
    
    for (let nation of meganation.nations) {
      NATION_COLORS[nation.toLowerCase()] = meganation.color;
    }
  }
}

console.log(browser.runtime.getURL("data.json"));
fetch(new Request(browser.runtime.getURL("data.json")))
  .then(function(response) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(function(text) {
    NATION_COLORS_FLAT = JSON.parse(text)
    recalculateNationColors()
    
    browser.webRequest.onBeforeRequest.addListener(
      requestListener,
      {urls: ["*://earthmc.net/map/tiles/_markers_/marker_earth.json", "*://earthmc.net/map/up/world/earth/*"]},
      ["blocking"]
    );
    console.log("All set up!")
  })


fetch("/data.json")
  .then(function(response) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(function(text) {
    NATION_COLORS_FLAT = JSON.parse(text)
    recalculateNationColors()
    
    console.log("Fetched updated colors!")
  })
  .catch(error => console.warn("Error while loading recent data:", error.message));
  
 
function shouldPaint(town) {
  let desc_title = town.desc.match(/<span style=\"font-size:120%\">(.+?)<\/span>/)
  if (!desc_title) {
    return;
  }
  desc_title = desc_title[1];
  if (!desc_title) {
    return;
  }
  let nation = desc_title.match(/.+? \((.+?)\)$/)
  if (!nation) {
    return;
  }
  nation = nation[1];
  if (!nation) {
    return;
  }
  if (NATION_COLORS[nation.toLowerCase()]) {
    return NATION_COLORS[nation.toLowerCase()]
  } else {
    return ["#3FB4FF"];
  }
}


  function requestListener(details) {
    var filter = browser.webRequest.filterResponseData(
      details.requestId
    )
    let decoder = new TextDecoder("utf-8");
    let encoder = new TextEncoder();
     console.log("Called!");
    let datar = [];  
    filter.ondata = event => {
      console.log("Called f!");
      datar.push(event.data);
    }

    filter.onstop = event => {
      console.log("ended");
      let str = "";
      if (datar.length == 1) {
        str = decoder.decode(datar[0]);
      }
      else {
        for (let i = 0; i < datar.length; i++) {
          let stream = (i == datar.length - 1) ? false : true;
          str += decoder.decode(datar[i], {stream});
        }
      }
      let data = JSON.parse(str);
      
      if (data.sets === undefined) {
         console.log("Non-map update")
         return;
      } else {
        console.log("Map update")
      }

      delete data.sets["townyPlugin.markerset"].markers;
      
      Object.values(data.sets["townyPlugin.markerset"].areas).forEach(town => {

        let paint = shouldPaint(town)
        //let paint = shouldPaint(town)
        town.weight = 1.6;
        town.opacity = 1;
        if (paint) {
          town.fillcolor = paint[0];
          // DEfault to fillcolor if color undefined
          town.color = paint[1] || paint[0];
        }
      })
      
      filter.write(encoder.encode(JSON.stringify(data)));
      
      filter.close();
    }
  }
