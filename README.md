useDrawPolygon 参数为map 和 options

默认参数
```javascript
const _options = {
    border: true,
    fillColor: '#0080ff',
    layerid: "draw-polygon",
    sourceid: "draw-polygon-source",
    pointslayerid: "polygon-points",
    midpointslayerid: "polygon-line-midpoints",
    midpointsourceid: "midpoint-source",
    editable: true,
    onMove: null,
    onEnd: null
}
```
自动合并自定义参数及字段

## Usage
```javascript
    useDrawPolygon(map, {
        onMove: (coordinates: []) => {
            if(coordinates[0].length >=4){
                fenceForm.area = turf.area(turf.polygon(coordinates))
            }
            fenceForm.coordinates = coordinates;
        },
        onEnd: (coordinates: []) => {
            fenceForm.area = turf.area(turf.polygon(coordinates))
            fenceForm.startPoint = `${coordinates[0][0][0]},${coordinates[0][0][1]}`
            fenceForm.coordinates = coordinates;
        }

    });
```
![image](https://github.com/ANALKH-DY/mapbox-draw-polygon/assets/85671820/c182e0a1-4aad-41c7-8201-d86f002ec9f7)
