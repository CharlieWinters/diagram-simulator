import * as React from 'react';
import {createRoot} from 'react-dom/client';

async function addSticky() {
  const stickyNote = await miro.board.createStickyNote({
    content: 'Hello, World!',
  });

  await miro.board.viewport.zoomTo(stickyNote);
}

async function isBase64UrlImage(base64String) {
  let image = new Image()
  image.src = base64String
  return await (new Promise((resolve)=>{
    image.onload = function () {
      if (image.height === 0 || image.width === 0) {
        resolve(false);
        return;
      }
      resolve(true)
    }
    image.onerror = () =>{
      resolve(false)
    }
  }))
}

function drawLine(ctx, x1, y1, x2, y2, color, width, offset) {
  ctx.beginPath();
  ctx.setLineDash([10, 10]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineDashOffset = offset;
  ctx.stroke();
}



async function imageMerge(operation){
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext("2d");
  
  let widgets = await miro.board.getSelection({type: 'image'})

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let imageWidgets = widgets.filter(widget => widget.type === 'image');
  let connectorWidgets = widgets.filter(widget => widget.type === 'connector');

  imageWidgets.forEach(widget => {
    let left = widget.x - widget.width / 2;
    let right = widget.x + widget.width / 2;
    let top = widget.y - widget.height / 2;
    let bottom = widget.y + widget.height / 2;
  
    if (left < minX) {
      minX = left;
    }
    if (top < minY) {
      minY = top;
    }
    if (right > maxX) {
      maxX = right;
    }
    if (bottom > maxY) {
      maxY = bottom;
    }
  });

  // Now minX, minY, maxX, maxY represent the bounding box
  let boundingBox = {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX,
    height: maxY - minY
  };

  canvas.width = maxX - minX;
  canvas.height = maxY - minY;

  imageWidgets = imageWidgets.sort(async(a, b) => {
    const prev = await a.getLayerIndex()
    const current = await b.getLayerIndex()
    return prev - current;
  });


  for (const widget of imageWidgets) {
    await new Promise(async(resolve, reject) => {
      let image = new Image();
      image.onload = function() {
        console.log(widget.x - boundingBox.left, widget.y - boundingBox.top, widget.width, widget.height)
        ctx.drawImage(image, (widget.x - widget.width / 2) - boundingBox.left, (widget.y - widget.height / 2) - boundingBox.top, widget.width, widget.height );
        ctx.globalCompositeOperation = operation;
        resolve();
      };
      image.onerror = reject;
      let dataUrl = await widget.getDataUrl();
      const isValid = await isBase64UrlImage(dataUrl)
      if (!isValid) {
        dataUrl =  dataUrl.replace('data:application/octet-stream;', 'data:image/svg+xml;');
      }
      image.src = dataUrl;
    });
  }

  const connectorLineArray = [];
  connectorWidgets.forEach(widget => {
    let startWidget = imageWidgets.find(imageWidget => imageWidget.id === widget.start.item);
    let endWidget = imageWidgets.find(imageWidget => imageWidget.id === widget.end.item);
    if (startWidget && endWidget) {
      let startX = startWidget.x - boundingBox.left + startWidget.width / 2;
      //let startX = startWidget.x - boundingBox.left;
      let startY = startWidget.y - boundingBox.top;
      let endX = endWidget.x - boundingBox.left - endWidget.width / 2;
      //let endX = endWidget.x - boundingBox.left;
      let endY = endWidget.y - boundingBox.top;
      //drawLine(ctx, startX, startY, endX, endY, widget.style.strokeColor, widget.style.strokeWidth);
      connectorLineArray.push([startX, startY, endX, endY])
    }
  });
  return {boundingBox: boundingBox, layer1Canvas: canvas, connectorLineArray: connectorLineArray};
}

const App = () => {
  const [layer1, setLayer1] = React.useState(null);
  const [layer2, setLayer2] = React.useState(null);
  const [lines, setLines] = React.useState(null);
  const [boundingBox, setBoundingBox] = React.useState(null);

  React.useEffect(() => {
    async function getData(){
      const {boundingBox,layer1Canvas,connectorLineArray} = await imageMerge("source-over")
      setLines(connectorLineArray);
      setBoundingBox(boundingBox);
      setLayer1(layer1Canvas);
    }
    getData()
  }, []);

  function drawLines(canvas,lines,color,offset) {
    const ctx = canvas.getContext("2d");
    lines.map(line => {
      drawLine(ctx, line[0], line[1], line[2], line[3], color, 20, offset);
    })
    setLayer2(canvas.toDataURL())
    console.log('drawLines',color, offset)
  }

  let frame = 0;

  React.useEffect(() => {
    if (lines){
      const interval = setInterval(() => {
        var canvas = document.createElement('canvas');
        canvas.width = boundingBox.width;
        canvas.height = boundingBox.height;
        const color =  '#0000FF'
        const offset = -frame * 2;
        drawLines(canvas,lines,color,offset)
        frame = frame === 100 ? 0 : frame + 1;
      }, 100);
      return () => clearInterval(interval);
    }
    
  }, [lines]);

  
    return (
      <div className="grid wrapper">
        <div className="cs1 ce12" >
          {layer1 ? <img src={layer1.toDataURL()} style={{position: 'absolute', objectFit: 'contain', width: '90%', height: '90%'}}/> : 'loading' }
          {layer2 && <img src={layer2} style={{position: 'absolute', objectFit: 'contain', width: '90%', height: '90%'}}/>}
        </div>
      </div>
    );
  
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
