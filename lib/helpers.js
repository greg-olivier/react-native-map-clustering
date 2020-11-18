import GeoViewport from "@mapbox/geo-viewport";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export const isMarker = (child) =>
  child &&
  child.props &&
  child.props.coordinate &&
  child.props.cluster !== false;

export const calculateBBox = (region) => {
  let lngD;
  if (region.longitudeDelta < 0) lngD = region.longitudeDelta + 360;
  else lngD = region.longitudeDelta;

  return [
    region.longitude - lngD, // westLng - min lng
    region.latitude - region.latitudeDelta, // southLat - min lat
    region.longitude + lngD, // eastLng - max lng
    region.latitude + region.latitudeDelta, // northLat - max lat
  ];
};

export const returnMapZoom = (region, bBox, minZoom) => {
  const viewport =
    region.longitudeDelta >= 40
      ? { zoom: minZoom }
      : GeoViewport.viewport(bBox, [width, height]);

  return viewport.zoom;
};

export const markerToGeoJSONFeature = (marker, index) => {
  return {
    type: "Feature",
    geometry: {
      coordinates: [
        marker.props.coordinate.longitude,
        marker.props.coordinate.latitude,
      ],
      type: "Point",
    },
    properties: {
      point_count: 0,
      index,
      ..._removeChildrenFromProps(marker.props),
    },
  };
};

/*
  Based on https://github.com/jawj/OverlappingMarkerSpiderfier 
*/

const twoPI = Math.PI * 2

export const generateCircle = (marker, clusterChildren, markers, zoom, index) => {
  const { properties, geometry } = marker;
  const count = properties.point_count;
  const centerLocation = geometry.coordinates;

  const circleFootSeparation = 1 / zoom
  const circleStartAngle = twoPI / 12
  const circumference = circleFootSeparation / (zoom * 3) 
  let legLength = circumference / twoPI
  const angleStep = twoPI / count
  

  let res = [];
  let angle = 0;
  let start = 0;

  for (let i = 0; i < index; i++) {
    start += markers[i].properties.point_count || 0;
  }

  for (let i = 0; i < count; i++) {
    angle = circleStartAngle + i * angleStep
    let latitude = centerLocation[1] + legLength * Math.cos(angle);
    let longitude = centerLocation[0] + legLength * Math.sin(angle);

    if (clusterChildren[i + start]) {
      res.push({
        index: clusterChildren[i + start].properties.index,
        longitude,
        latitude,
        centerPoint: {
          latitude: centerLocation[1],
          longitude: centerLocation[0],
        },
      });
    }
  }

  return res;
};

export const generateSpiral = (marker, clusterChildren, markers, zoom, index) => {
  const { properties, geometry } = marker;
  const count = properties.point_count;
  const centerLocation = geometry.coordinates;

  const spiralLengthStart = 0.000024;
  const spiralLengthFactor = 0.0000054;
  const spiralFootSeparation = 0.000042;
  let legLength = spiralLengthStart;

  let res = [];
  let angle = 0;
  let start = 0;

  for (let i = 0; i < index; i++) {
    start += markers[i].properties.point_count || 0;
  }

  for (let i = 0; i < count; i++) {
    angle += spiralFootSeparation / legLength + i * 1.5 / (zoom * count)
    let latitude = centerLocation[1] + legLength * Math.cos(angle);
    let longitude = centerLocation[0] + legLength * Math.sin(angle);
    legLength += (twoPI * spiralLengthFactor) / angle

    if (clusterChildren[i + start]) {
      res.push({
        index: clusterChildren[i + start].properties.index,
        longitude,
        latitude,
        centerPoint: {
          latitude: centerLocation[1],
          longitude: centerLocation[0]
        }
      });
      if (i > 0) {
        const indexPrevPoint = res.findIndex(point => point.index ===  clusterChildren[i - 1 + start].properties.index)
        if (indexPrevPoint !== -1) {
          const prevPoint = res[indexPrevPoint];
          prevPoint.nextPoint = { latitude, longitude };
          res.splice(indexPrevPoint, 1, prevPoint)
        }
      }
    }
  }

  return res.reverse();
};

export const returnMarkerStyle = (points) => {
  if (points >= 50) {
    return {
      width: 84,
      height: 84,
      size: 64,
      fontSize: 20,
    };
  }

  if (points >= 25) {
    return {
      width: 78,
      height: 78,
      size: 58,
      fontSize: 19,
    };
  }

  if (points >= 15) {
    return {
      width: 72,
      height: 72,
      size: 54,
      fontSize: 18,
    };
  }

  if (points >= 10) {
    return {
      width: 66,
      height: 66,
      size: 50,
      fontSize: 17,
    };
  }

  if (points >= 8) {
    return {
      width: 60,
      height: 60,
      size: 46,
      fontSize: 17,
    };
  }

  if (points >= 4) {
    return {
      width: 54,
      height: 54,
      size: 40,
      fontSize: 16,
    };
  }

  return {
    width: 48,
    height: 48,
    size: 36,
    fontSize: 15,
  };
};

const _removeChildrenFromProps = (props) => {
  const newProps = {};
  Object.keys(props).forEach((key) => {
    if (key !== "children") {
      newProps[key] = props[key];
    }
  });
  return newProps;
};
