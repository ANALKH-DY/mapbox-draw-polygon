/**
 * @author Duyuan
 * @license MIT
 */
import { message } from 'ant-design-vue';
import * as turf from '@turf/turf'

const coordinates = [];
const midPointGeoJson = {
    type: "FeatureCollection",
    features: []
};

const _options = {
    border: true,
    fillColor: '#0080ff',
    layerid: "draw-polygon",
    outlinelayerid: "draw-polygon-outline",
    sourceid: "draw-polygon-source",
    pointslayerid: "polygon-points",
    midpointslayerid: "polygon-line-midpoints",
    midpointsourceid: "midpoint-source",
    editable: true,
    onMove: null,
    onEnd: null
}

let isStarted = false, isEnded = false;

function createPointFeature(lng, lat, properties = {}) {
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [lng, lat],
            properties
        }
    }
}

function coordinateChanged(map) {
    if (coordinates.length < 2) {
        midPointGeoJson.features.length = 0;
    } else {
        for (var i = 1; i < coordinates.length; i++) {
            const coordinate = [(coordinates[i][0] + coordinates[i - 1][0]) / 2, (coordinates[i][1] + coordinates[i - 1][1]) / 2];
            // console.log("coordinate: ", coordinate);
            if (midPointGeoJson.features[i - 1] === undefined) {
                midPointGeoJson.features[i - 1] = createPointFeature(
                    coordinate[0],
                    coordinate[1]
                );
            } else {
                // 数值赋值，解绑避免继续引用coordinate
                midPointGeoJson.features[i - 1].geometry.coordinates[0] = coordinate[0];
                midPointGeoJson.features[i - 1].geometry.coordinates[1] = coordinate[1];
            }
        }
    }
    map.getSource(_options.midpointsourceid).setData(midPointGeoJson)
    console.log("midPointGeoJson:", midPointGeoJson);
}

// 得到最近点下标 O(N)
function getNearestPoint(lng, lat) {
    let minDistance = Number.MAX_VALUE, index;
    var from = turf.point([lng, lat]);
    var options = { units: 'miles' };
    coordinates.forEach((coordinate, _index) => {
        let to = turf.point(coordinate);
        let distance = turf.distance(from, to, options);
        if (distance < minDistance) minDistance = distance, index = _index;
    })
    return index;
}

// 得到最近的中点下标 O(N)
function getNearestMidPoint(lng, lat) {
    let minDistance = Number.MAX_VALUE, index;
    var from = turf.point([lng, lat]);
    var options = { units: 'miles' };
    midPointGeoJson.features.forEach((feature, _index) => {
        let to = turf.point(feature.geometry.coordinates);
        let distance = turf.distance(from, to, options);
        if (distance < minDistance) minDistance = distance, index = _index;
    })
    return index;
}

// 添加多边形边框图层
function addPolygonBorderLayer(map) {
    if (map.getLayer(_options.outlinelayerid)) return;
    map.addLayer({
        id: _options.outlinelayerid,
        type: "line",
        source: _options.sourceid,
        layout: {},
        'paint': {
            'line-dasharray': [2, 2],
            'line-color': '#66cc00',
            'line-width': 3,
            "line-emissive-strength": 1,
        }
    })
}

function createEditModule(map) {
    // 配置可修改
    // 点击多边形，变色，点可拖动，同时修改多边形geojson的对应数据
    let midPointSource = map.getSource(_options.midpointsourceid);

    let editPointIndex = -1, editMidPointIndex = -1;

    if (!midPointSource) {
        map.addSource(_options.midpointsourceid, {
            type: "geojson",
            data: midPointGeoJson
        })
    }
    if (!map.getLayer(_options.midpointslayerid)) {
        // 中辅助点图层
        map.addLayer({
            id: _options.midpointslayerid,
            source: _options.midpointsourceid,
            type: "circle",
            paint: {
                "circle-radius": _options.border ? 4 : 2,
                "circle-color": "#ffff00",
                "circle-stroke-color": "#333333"
            }
        })
        console.log("已添加中点layer");
    }
    if (!map.getLayer(_options.pointslayerid)) {
        // 辅助点图层
        map.addLayer({
            id: _options.pointslayerid,
            source: _options.sourceid,
            type: "circle",
            paint: {
                "circle-radius": _options.border ? 5 : 3,
                "circle-color": "#ffffff",
                "circle-stroke-color": "#333333"
            }
        })
    }
    

    function onPointMouseDown(e) {
        if (isEnded) {
            // Prevent the default map drag behavior.
            e.preventDefault();
            console.log("onPointMouseDown");
            // 根据距离找哪个点最近
            editPointIndex = getNearestPoint(e.lngLat.lng, e.lngLat.lat);

            map.getCanvas().style.cursor = 'grab';
            map.on('mousemove', onPointMouseMove)
            map.once('mouseup', onPointMouseUp);
        }
    }
    function onPointMouseMove(e) {
        console.log("onPointMouseMove");
        if (isEnded) {
            if (editPointIndex != -1) {

                if (editPointIndex === 0 || editPointIndex == coordinates.length - 1) {
                    coordinates[0][0] = e.lngLat.lng;
                    coordinates[0][1] = e.lngLat.lat;
                    coordinates[coordinates.length - 1][0] = e.lngLat.lng;
                    coordinates[coordinates.length - 1][1] = e.lngLat.lat;
                } else {
                    coordinates[editPointIndex][0] = e.lngLat.lng;
                    coordinates[editPointIndex][1] = e.lngLat.lat;
                }
                coordinateChanged(map);
                map.getSource(_options.sourceid).setData({
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [coordinates],
                        properties: {
                            index: coordinates.length
                        }
                    }
                })
                _options.onMove && _options.onMove([coordinates]);
            }
        }
    }
    function onPointMouseUp(e) {
        if (isEnded) {
            map.off('mousemove', onPointMouseMove)
            console.log("mouseup coordinates: ", coordinates);
        }
    }
    function onMidPointMouseDown(e) {
        if (isEnded) {
            // Prevent the default map drag behavior.
            e.preventDefault();

            const { lng, lat } = e.lngLat;

            // get point feature
            editMidPointIndex = getNearestMidPoint(e.lngLat.lng, e.lngLat.lat);
            console.log("midpoint index:", editMidPointIndex);
            map.getCanvas().style.cursor = 'grab';

            coordinates.splice(editMidPointIndex + 1, 0, [lng, lat]);
            coordinateChanged(map);
            map.on('mousemove', onMidPointMouseMove);
            map.once('mouseup', onMidPointMouseUp)
        }
    }
    function onMidPointMouseMove(e) {
        if (isEnded) {
            if (editMidPointIndex != -1) {
                const { lng, lat } = e.lngLat;

                coordinates[editMidPointIndex + 1][0] = lng;
                coordinates[editMidPointIndex + 1][1] = lat;
                // 修改数据
                map.getSource(_options.sourceid).setData({
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [coordinates],
                        properties: {}
                    }
                })
                coordinateChanged(map);
                _options.onMove && _options.onMove([coordinates]);
            }
        }
    }
    function onMidPointMouseUp() {
        if (isEnded) {
            map.off('mousemove', onMidPointMouseMove)
        }
    }
    if(!midPointSource){
        // 注册移入移出事件钩子
        map.on('mouseenter', _options.pointslayerid, (e) => {
            if (isEnded) {
                map.getCanvas().style.cursor = "grab";
            }
        });
        map.on('mouseenter', _options.midpointslayerid, (e) => {
            if (isEnded) {
                map.getCanvas().style.cursor = "grab";
            }
        });
        map.on('mouseleave', _options.pointslayerid, (e) => {
            if (isEnded) {
                map.getCanvas().style.cursor = "";
            }
        });
        map.on('mouseleave', _options.midpointslayerid, (e) => {
            if (isEnded) {
                map.getCanvas().style.cursor = "";
            }
        });
        // 注册鼠标按下（点，中点）事件钩子
        map.on('mousedown', _options.pointslayerid, onPointMouseDown);
        map.on('mousedown', _options.midpointslayerid, onMidPointMouseDown);
    }
}

function useDrawPolygon(map, options) {

    console.log("useDrawPolygon");
    isStarted = false, isEnded = false;
    Object.assign(_options, options);

    let source, startPoint, endPoint;

    source = map.getSource(_options.sourceid)

    if (!source) {
        map.addSource(_options.sourceid, {
            type: "geojson",
            data: {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [],
                    properties: {
                        name: "绘制的区域"
                    }
                }
            }
        })
        map.addLayer({
            id: _options.layerid,
            type: "fill",
            source: _options.sourceid,
            layout: {},
            paint: {
                "fill-color": _options.fillColor,
                "fill-emissive-strength": 1,
                "fill-opacity": 0.5
            }
        })



    }

    if (_options.border) addPolygonBorderLayer(map)


    const handleMapClick = (e) => {
        const { lng, lat } = e.lngLat;

        if (!startPoint) {
            startPoint = e.lngLat;
        }

        if (!isStarted) isStarted = true;
        coordinates.push([lng, lat]);
        console.log("coordinates:", coordinates);
        // source.setData({
        //     type: "Feature",
        //     geometry: {
        //         type: "Polygon",
        //         coordinates: [coordinates],
        //         properties: {
        //             index: coordinates.length
        //         }
        //     }
        // })

    }

    const handleMapDblclick = (e) => {
        console.log("handleMapDblclick");
        e.preventDefault();
        endPoint = e.lngLat;
        // 第一次点击时，会注入点，导致重复
        coordinates.pop()

        if (endPoint.lng != startPoint.lng || endPoint.lat != startPoint.lat) {
            coordinates.push([startPoint.lng, startPoint.lat]);
            source.setData({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [coordinates],
                    properties: {
                        index: coordinates.length
                    }
                }
            })
        }
        map.off('click', handleMapClick);
        map.off('mousemove', handleMouseMove);

        if (_options.editable) createEditModule(map)

        map.getCanvas().style.cursor = "default";
        map.doubleClickZoom.enable();
        console.log("结束绘制多边形", coordinates);
        message.info("结束绘制多边形");
        coordinateChanged(map);

        isStarted = false;
        isEnded = true;

        
        _options.onEnd && _options.onEnd([coordinates]);
    }

    const handleMouseMove = (e) => {
        const { lng, lat } = e.lngLat;
        source = map.getSource(_options.sourceid);
        const currentCoordinates = [Array.prototype.concat.call(coordinates, startPoint ? [[lng, lat], [startPoint.lng, startPoint.lat]] : [[lng, lat]])];
        // console.log("currentCoordinates:", currentCoordinates);
        if (currentCoordinates.length <= 2) {
            source.setData({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: currentCoordinates[0],
                    properties: {
                        index: coordinates.length
                    }
                }
            })
        } else {
            source.setData({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: currentCoordinates,
                    properties: {
                        index: coordinates.length
                    }
                }
            })
        }
        isStarted && _options.onMove && _options.onMove(currentCoordinates)
    }

    const startDrawPolygon = () => {
        console.log("coordinates:", coordinates);
        midPointGeoJson.features.length = 0;
        
        map.getCanvas().style.cursor = "pointer";
        source = map.getSource(_options.sourceid);
        if(options.coordinates) {
            coordinates.push(...options.coordinates)
            source.setData({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [coordinates],
                    properties: {
                        index: coordinates.length
                    }
                }
            })
            if(_options.editable) createEditModule(map);
            isEnded = true;
            coordinateChanged(map);
        }else{
            // 注册钩子
            map.on('click', handleMapClick);
            map.on('mousemove', handleMouseMove);
            map.once('dblclick', handleMapDblclick);

        }

        // 禁止双击缩放
        map.doubleClickZoom.disable();
        console.log("开始绘制多边形");
        message.info("开始绘制多边形");
    }

    const clearMapListener = (map) => {
        map.off('click', handleMapClick);
        map.off('mousemove', handleMouseMove);
        map.off('dblclick', handleMapDblclick);
    }

    if (source) {
        coordinates.length = 0;
        source.setData({
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: coordinates,
                properties: {
                    name: "绘制的区域"
                }
            }
        })
        coordinateChanged(map);
        clearMapListener(map);
        startDrawPolygon();
    } else {
        map.once('sourcedata', startDrawPolygon)
    }



}

export { useDrawPolygon };
