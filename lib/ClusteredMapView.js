import React, {
  memo,
  useState,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
} from "react";
import { Dimensions, LayoutAnimation, Platform } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import SuperCluster from "supercluster";
import ClusterMarker from "./ClusteredMarker";
import {
  isMarker,
  markerToGeoJSONFeature,
  calculateBBox,
  returnMapZoom,
  generateSpiral,
  generateCircle
} from "./helpers";

const ClusteredMapView = forwardRef(
  (
    {
      radius,
      maxZoom,
      minZoom,
      extent,
      nodeSize,
      children,
      onClusterPress,
      onRegionChangeComplete,
      onMarkerPress,
      animateToSpiderifiedMarker,
      onMarkersChange,
      preserveClusterPressBehavior,
      clusteringEnabled,
      clusterColor,
      clusterTextColor,
      clusterFontFamily,
      spiderLineColor,
      layoutAnimationConf,
      animationEnabled,
      renderCluster,
      tracksViewChanges,
      spiderEnabled,
      circleSpiralSwitchover,
      superClusterRef,
      ...restProps
    },
    ref
  ) => {
    const [markers, updateMarkers] = useState([]);
    const [spiderMarkers, updateSpiderMarker] = useState([]);
    const [otherChildren, updateChildren] = useState([]);
    const [superCluster, setSuperCluster] = useState(null);
    const [currentRegion, updateRegion] = useState(
      restProps.region || restProps.initialRegion
    );

    const [isSpiderfier, updateSpiderfier] = useState(false);
    const [clusterChildren, updateClusterChildren] = useState(null);
    const mapRef = useRef();

    const propsChildren = useMemo(() => React.Children.toArray(children), [
      children,
    ]);

    useEffect(() => {
      const rawData = [];
      const otherChildren = [];

      if (!clusteringEnabled) {
        updateSpiderMarker([]);
        updateMarkers([]);
        updateChildren(propsChildren);
        return;
      }

      React.Children.forEach(children, (child, index) => {
        if (isMarker(child)) {
          rawData.push(markerToGeoJSONFeature(child, index));
        } else {
          otherChildren.push(child);
        }
      });

      const superCluster = new SuperCluster({
        radius,
        maxZoom,
        minZoom,
        extent,
        nodeSize,
      });

      superCluster.load(rawData);

      const bBox = calculateBBox(currentRegion);
      const zoom = returnMapZoom(currentRegion, bBox, minZoom);
      const markers = superCluster.getClusters(bBox, zoom);

      updateMarkers(markers);
      updateChildren(otherChildren);
      setSuperCluster(superCluster);

      superClusterRef.current = superCluster;
    }, [
      children,
      restProps.region,
      restProps.initialRegion,
      clusteringEnabled,
    ]);

    useEffect(() => {
      if (!spiderEnabled) return;

      if (isSpiderfier && markers.length > 0) {
        let allSpiderMarkers = [];

        const bBox = calculateBBox(currentRegion);
        const zoom = returnMapZoom(currentRegion, bBox, minZoom);

        markers.map((marker, i) => {
          let positions = generateCircle(marker, clusterChildren, markers, zoom, i);
          if (clusterChildren.length > circleSpiralSwitchover)
            positions = generateSpiral(marker, clusterChildren, markers, zoom, i);

          allSpiderMarkers.push(...positions);
        });

        updateSpiderMarker(allSpiderMarkers);
      } else {
        updateSpiderMarker([]);
      }
    }, [isSpiderfier, markers, currentRegion]);

    const _onMarkerPress = event => {
      if (animateToSpiderifiedMarker && mapRef.current && event.nativeEvent.id !== 'unknown') {
        mapRef.current.animateToRegion({...currentRegion, ...event.nativeEvent.coordinate})
      }
      onMarkerPress(event)
    }

    const _onRegionChangeComplete = (region) => {
      if (superCluster) {
        const bBox = calculateBBox(region);
        const zoom = returnMapZoom(region, bBox, minZoom);
        const markers = superCluster.getClusters(bBox, zoom);

        if (animationEnabled && Platform.OS === "ios") {
          LayoutAnimation.configureNext(layoutAnimationConf);
        }
        if (zoom >= 18 && markers.length > 0 && clusterChildren) {
          if (spiderEnabled) updateSpiderfier(true);
        } else {
          if (spiderEnabled) updateSpiderfier(false);
        }

        updateMarkers(markers);
        onMarkersChange(markers);
        onRegionChangeComplete(region, markers);
        updateRegion(region);
      } else {
        onRegionChangeComplete(region);
      }
    };

    const _onClusterPress = (cluster) => () => {
      const children = superCluster.getLeaves(cluster.id, Infinity);
      updateClusterChildren(children);

      if (preserveClusterPressBehavior) {
        onClusterPress(cluster, children);
        return;
      }

      const coordinates = children.map(({ geometry }) => ({
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
      }));

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: restProps.edgePadding,
      });

      onClusterPress(cluster, children);
    };

    return (
      <MapView
        onMarkerPress={_onMarkerPress}
        {...restProps}
        ref={(map) => {
          mapRef.current = map;
          if (ref) ref.current = map;
          restProps.mapRef(map);
        }}
        onRegionChangeComplete={_onRegionChangeComplete}
      >
        {markers.map((marker) =>
          marker.properties.point_count === 0 ? (
            propsChildren[marker.properties.index]
          ) : !isSpiderfier ? (
            renderCluster ? (
              renderCluster({
                onPress: _onClusterPress(marker),
                clusterColor,
                clusterTextColor,
                clusterFontFamily,
                ...marker,
              })
            ) : (
              <ClusterMarker
                key={`cluster-${marker.id}`}
                id={`cluster-${marker.id}`}
                {...marker}
                onPress={_onClusterPress(marker)}
                clusterColor={clusterColor}
                clusterTextColor={clusterTextColor}
                clusterFontFamily={clusterFontFamily}
                tracksViewChanges={tracksViewChanges}
              />
            )
          ) : null
        )}
        {otherChildren}
        {spiderMarkers.map((marker) => {
          return propsChildren[marker.index]
            ? React.cloneElement(propsChildren[marker.index], {
                coordinate: { ...marker }
            })
            : null;
        })}
        {spiderMarkers.map((marker, index) => {
          {
            let coordinates = [marker.centerPoint, marker, marker.centerPoint]
            if (spiderMarkers.length > circleSpiralSwitchover) {
              if (!marker?.nextPoint) return null
              coordinates = [marker.nextPoint, marker, marker.nextPoint]
            }
            return (
              <Polyline
                key={index}
                coordinates={coordinates}
                strokeColor={spiderLineColor}
                strokeWidth={1}
              />
            );
          }
        })}
      </MapView>
    );
  }
);


ClusteredMapView.defaultProps = {
  clusteringEnabled: true,
  spiderEnabled: true,
  circleSpiralSwitchover: 20,
  animationEnabled: true,
  animateToSpiderifiedMarker: true,
  preserveClusterPressBehavior: false,
  layoutAnimationConf: LayoutAnimation.Presets.spring,
  tracksViewChanges: false,
  // SuperCluster parameters
  radius: Dimensions.get("window").width * 0.06,
  maxZoom: 20,
  minZoom: 1,
  extent: 512,
  nodeSize: 64,
  // Map parameters
  edgePadding: { top: 50, left: 50, right: 50, bottom: 50 },
  // Cluster styles
  clusterColor: "#00B386",
  clusterTextColor: "#FFFFFF",
  spiderLineColor: "#FF0000",
  // Callbacks
  onRegionChangeComplete: () => {},
  onClusterPress: () => {},
  onMarkerPress: () => {},
  onMarkersChange: () => {},
  superClusterRef: {},
  mapRef: () => {},
};

export default memo(ClusteredMapView);
