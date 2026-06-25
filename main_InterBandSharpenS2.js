/**** Demos of using the inter-band sharpening in RASSFM 2.0.
 *
 * This file contains two manners of call the interband sharpening module in RASSFM 2.0. 
 * Choose one that is most suitable for your sharpening scenarios.
 *
 * Public module path (contains the functions of inter-band sharpening):
 *   users/bingxun/RASSFM2:InterbandSharpenS2_GEE_module OR 
 *   https://code.earthengine.google.com/7eb3af14b676a5103660ea9f101a05c8
 *   Full MATLAB repo: https://zenodo.org/doi/10.5281/zenodo.19046912
 * 
 * References:
 * Yongquan Zhao, Desheng Liu, Xiaolin Zhu, Ming Luo, Bo Huang, Chunqiao Song, Xuejun Duan. 2026. 
 *   RASSFM 2.0: An enhanced M2Msharpening model for blending PlanetScope and Sentinel-2 imagery across broad landscapes and improved land cover classification. 
 *   Remote Sensing of Environment, 338, 115371. doi: 10.1016/j.rse.2026.115371
 * Yongquan Zhao, Desheng Liu. 2022. A robust and adaptive spatial-spectral fusion model for PlanetScope and Sentinel-2 imagery. 
 *   GIScience & Remote Sensing, 59(1), 520-546. doi: 10.1080/15481603.2022.2036054
 * 
 * Copyright and License:
 * Copyright (c) 2026 Yongquan Zhao, yqzhao@link.cuhk.edu.hk, Ningjing Institute of Geography and Limnology, Chinese Academy of Sciences (NIGLAS).
 * This repository is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) license.
 */

var S2InterbandSharp = require('users/bingxun/RASSFM2:InterbandSharpenS2_GEE_module'); // The interband sharpening module path.

// ======================================================================
// Manner 1. Native 10-m and 20-m inputs from GEE Assets.
// Manner 2 is actually the same as Manner 1 but with different data sources.
// ======================================================================
//
// Use this when the input is already separated into four native 10-m bands and six native 20-m bands.
//
// Entry point:
//   run(...)
//
// Note:
//   This is the cleanest entry point when native Sentinel-2 10-m and 20-m inputs are both available.

function runAssetManner() {
  // Replace the two asset ids below.
  var s2_10mAssetId = 'projects/ee-bingxun/assets/nanjing_test_split_10m';
  var s2_20mAssetId = 'projects/ee-bingxun/assets/nanjing_test_split_20m';
  var crs = 'EPSG:32650';

  var s2_10m = ee.Image(s2_10mAssetId).select(['B2', 'B3', 'B4', 'B8']);
  var s2_20m = ee.Image(s2_20mAssetId).select(['B5', 'B6', 'B7', 'B8A', 'B11', 'B12']);
  var region = s2_10m.geometry();

  var result = S2InterbandSharp.run({
    s2_10m: s2_10m,
    s2_20m: s2_20m,
    region: region,
    crs: crs,
    outputType: 'int16',
    
    // Whether printing the interband sharpening logs.
    debug: false
  });

  var full10BandStack = result.image;
  // var sharpened20mOnly = result.sharpened20m;

  print('Manner 1 result object', result);
  print('Manner 1 full 10-band stack', full10BandStack);
  print('Manner 1 full 10-band names', full10BandStack.bandNames());
  // print('Manner 1 sharpened 20-m bands only', sharpened20mOnly);
  // print('Manner 1 sharpened 20-m band names', sharpened20mOnly.bandNames());

  Map.centerObject(region, 13);
  Map.addLayer(full10BandStack.select(['B8', 'B4', 'B3']), {min: 100, max: 4000}, 'Manner 1: Input 10-m B8/B4/B3');
  Map.addLayer(s2_20m.select(['B11', 'B8A', 'B5']), {min: 100, max: 4000}, 'Manner 1: Input 20-m B11/B8A/B5');
  Map.addLayer(full10BandStack.select(['B11', 'B8A', 'B5']), {min: 100, max: 4000}, 'Manner 1: Sharpened 10-m B11/B8A/B5');

  Export.image.toDrive({
    image: full10BandStack,
    description: 'S2interbandsharp_asset',
    folder: 'GEE_exports',
    fileNamePrefix: 'S2interbandsharp_asset',
    region: region,
    crs: crs,
    scale: 10,
    maxPixels: 1e13
  });
}

// Run Manner 1.
runAssetManner();



// ======================================================================
// Manner 2. ROI -> Online Sentinel-2 composite/mosaic -> interband sharpening
// ======================================================================
//
// Use this for the normal GEE workflow: define an ROI, build one Sentinel-2
// composite/mosaic, then feed the 10-m and 20-m bands into interband sharpening.
//
// Entry point:
//   run(...)
//
// Note:
//   The key step is to pass B2/B3/B4/B8 as s2_10m and B5/B6/B7/B8A/B11/B12
//   as s2_20m. The module returns a 10-band 10-m stack.

function runOnlineManner() {
  var roi = ee.Geometry.Rectangle([118.55, 31.75, 119.05, 32.25], null, false);
  var crs = 'EPSG:32650';

  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roi)
    .filterDate('2021-07-01', '2021-09-30')
    .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 10));

  var composite = s2
    .sort('CLOUDY_PIXEL_PERCENTAGE', false)
    .mosaic()
    .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']);

  // S2 10-m input: B2/B3/B4/B8.
  var s2_10m = composite.select(['B2', 'B3', 'B4', 'B8']);

  // S2 20-m input: B5/B6/B7/B8A/B11/B12.
  var s2_20m = composite.select(['B5', 'B6', 'B7', 'B8A', 'B11', 'B12']);

  var result = S2InterbandSharp.run({
    s2_10m: s2_10m,
    s2_20m: s2_20m,
    region: roi,
    crs: crs,
    outputType: 'int16',
    
    // Whether printing the interband sharpening logs.
    debug: false
  });

  var full10BandStack = result.image.clip(roi);
  // var sharpened20mOnly = result.sharpened20m.clip(roi);

  print('Manner 2 Sentinel-2 image count', s2.size());
  print('Manner 2 result object', result);
  print('Manner 2 full 10-band stack', full10BandStack);
  print('Manner 2 full 10-band names', full10BandStack.bandNames());
  // print('Manner 2 sharpened 20-m bands only', sharpened20mOnly);
  // print('Manner 2 sharpened 20-m band names', sharpened20mOnly.bandNames());

  Map.centerObject(roi, 13);
  Map.addLayer(full10BandStack.select(['B8', 'B4', 'B3']), {min: 100, max: 4000}, 'Manner 2: Input 10-m B8/B4/B3');
  Map.addLayer(s2_20m.clip(roi).select(['B11', 'B8A', 'B5']), {min: 100, max: 4000}, 'Manner 2: Input 20-m B11/B8A/B5');
  Map.addLayer(full10BandStack.select(['B11', 'B8A', 'B5']), {min: 100, max: 4000}, 'Manner 2: Sharpened 10-m B11/B8A/B5');
  
  Export.image.toDrive({
    image: full10BandStack,
    description: 'S2interbandsharp_online',
    folder: 'GEE_exports',
    fileNamePrefix: 'S2interbandsharp_online',
    region: roi,
    crs: crs,
    scale: 10,
    maxPixels: 1e13
  });
}

// Run Manner 2.
runOnlineManner();
