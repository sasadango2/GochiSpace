import React, { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

function GoogleMap() {
  const mapRef = useRef(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 35.6762, lng: 139.6503 }, // 東京駅
        zoom: 14,
      });

      // Places APIでレストラン検索
      const service = new window.google.maps.places.PlacesService(map);
      const request = {
        location: { lat: 35.6762, lng: 139.6503 },
        radius: 1000,
        type: ['restaurant']
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          results.forEach((place) => {
            new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
            });
          });
        }
      });
    }).catch(error => {
      console.error('Google Maps API読み込みエラー:', error);
    });
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
}

export default GoogleMap;