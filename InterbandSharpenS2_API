/**** RASSFM 2.0 Sentinel-2 inter-band sharpening module for Google Earth Engine.
 * This file implements only the Sentinel-2 inter-band sharpening module of RASSFM 2.0.
 *
 * This file is intended as a reusable API module, not a standalone run script.
 *
 * It does not call Map.addLayer() or Export.image.*() by itself.
 *
 * Public API:
 *   RASSFM2Interband.interbandSharpenS2(args)
 *     Returns the full 10-band Sentinel-2 stack at 10 m.
 *
 *   RASSFM2Interband.sharpen20mOnly(args)
 *     Returns only the six sharpened 20 m bands at 10 m.
 *
 *   RASSFM2Interband.run(args)
 *     Returns sharpened bands plus intermediate diagnostics.
 *
 *   RASSFM2Interband.fromTenBandStack(args)
 *     Convenience wrapper for one uploaded 10-band, 10 m stack asset.
 *
 *   RASSFM2Interband.makeHeaderRegion(args)
 *     Builds an exact projected rectangle from ENVI/GDAL header metadata.
 *
 * Required band names:
 *   10 m bands: B2, B3, B4, B8
 *   20 m bands: B5, B6, B7, B8A, B11, B12
 *
 * Output data type:
 *   outputType: 'float' keeps decimal values and is recommended for validation.
 *   outputType: 'int16' rounds and clamps values to 0-10000, reducing export size.
 *
 * Example, native 10 m and 20 m inputs:
 *   var result = RASSFM2Interband.run({
 *     s2_10m: s2_10m.select(['B2', 'B3', 'B4', 'B8']),
 *     s2_20m: s2_20m.select(['B5', 'B6', 'B7', 'B8A', 'B11', 'B12']),
 *     region: roi,
 *     crs: 'EPSG:32650',
 *     outputType: 'float'
 *   });
 *   var full10BandStack = result.image;
 *   var sharp20To10m = result.sharpened20m;
 *
 * Example, uploaded 10-band GeoTIFF stack:
 *   var input = ee.Image('projects/ee-bingxun/assets/nanjing_test_tiff');
 *   var region = input.geometry();
 *   var result = RASSFM2Interband.fromTenBandStack({
 *     image: input,
 *     region: region,
 *     crs: 'EPSG:32650',
 *     outputType: 'int16'
 *   });
 *   var full10BandStack = result.image;
 *   var sharp20To10m = result.sharpened20m;
 *
 * Optional exact ROI from header metadata:
 *   var exactRegion = RASSFM2Interband.makeHeaderRegion({
 *     xmin: 656080,
 *     ymax: 3552620,
 *     cols: 1500,
 *     rows: 1500,
 *     scale: 10,
 *     crs: 'EPSG:32650'
 *   });
 *
 *   Export.image.toDrive({
 *     image: result.image,
 *     description: 'rassfm2_interband',
 *     region: region,
 *     crs: 'EPSG:32650',
 *     scale: 10,
 *     maxPixels: 1e13
 *   });
 *
 * If this file is saved as a GEE script module, it can also be used with:
 *   var rassfm = require('users/bingxun/RASSFM2:InterbandSharpenS2_GEE_module');
 *   var result = rassfm.fromTenBandStack({...});
 *
 * Module scope:
 *   This file only performs Sentinel-2 inter-band sharpening, not the full RASSFM 2.0 workflow.
 *   It sharpens six Sentinel-2 20 m bands to 10 m, then rebuilds a 10-band 10 m stack.
 *
 * Corresponding MATLAB files (full MATLAB repo: https://zenodo.org/doi/10.5281/zenodo.19046912):
 *   InterbandSharpenS2.m
 *   SpecTrans_S2.m
 *   SpecCorr.m
 *   BandCombine.m
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

var RASSFM2Interband = (function() {
  // Default Sentinel-2 band order.
  // stack10 is the final 10-band output order; s2_10m and s2_20m are algorithm inputs.
  var DEFAULT_BANDS = {
    stack10: ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'],
    s2_10m: ['B2', 'B3', 'B4', 'B8'],
    s2_20m: ['B5', 'B6', 'B7', 'B8A', 'B11', 'B12'],
    reNnir20m: ['B5', 'B6', 'B7', 'B8A']
  };

  // Allow users to override band names or band order; use Sentinel-2 defaults when omitted.
  function getBandOptions(options) {
    var userBands = (options && options.bandOrder) || {};
    return {
      stack10: userBands.stack10 || DEFAULT_BANDS.stack10,
      s2_10m: userBands.s2_10m || DEFAULT_BANDS.s2_10m,
      s2_20m: userBands.s2_20m || DEFAULT_BANDS.s2_20m,
      reNnir20m: userBands.reNnir20m || DEFAULT_BANDS.reNnir20m
    };
  }

  // Collect all runtime options. Most callers only need crs, region, and input images.
  function getOptions(options) {
    options = options || {};
    return {
      crs: options.crs || 'EPSG:32650',
      scale10: options.scale10 || 10,
      scale20: options.scale20 || 20,
      maxPixels: options.maxPixels || 1e13,
      tileScale: options.tileScale || 16,
      debug: options.debug || false,
      outputType: options.outputType || 'float',
      int16Min: options.int16Min !== undefined ? options.int16Min : 0,
      int16Max: options.int16Max !== undefined ? options.int16Max : 10000,
      bands: getBandOptions(options)
    };
  }

  // Force image projection and scale to avoid uncontrolled implicit reprojection in GEE.
  function forceScale(image, scale, options) {
    return ee.Image(image).reproject({
      crs: options.crs,
      scale: scale
    });
  }

  // Cast final outputs to the requested data type.
  function castOutput(image, options) {
    image = ee.Image(image);

    if (options.outputType === 'float') {
      return image.toFloat();
    }

    if (options.outputType === 'int16') {
      return image
        .round()
        .clamp(options.int16Min, options.int16Max)
        .toInt16();
    }

    throw new Error('Unsupported outputType: ' + options.outputType + '. Use float or int16.');
  }

  // Corresponds to MATLAB imresize(..., 'box'): aggregate 10 m pixels to 20 m by mean.
  function downsampleMean(image, scale, options) {
    return ee.Image(image)
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1024
      })
      .reproject({
        crs: options.crs,
        scale: scale
      });
  }

  // Corresponds to MATLAB imresize(..., 'bicubic') for upsampling.
  // GEE and MATLAB handle bicubic edges differently, so bit-level equality is not expected.
  function upsampleBicubic(image, scale, options) {
    return ee.Image(image)
      .resample('bicubic')
      .reproject({
        crs: options.crs,
        scale: scale
      });
  }

  // Compute multiple Pearson correlations with one reduceRegion call.
  // This keeps the module usable in the GEE web preview by avoiding too many concurrent aggregations.
  function pairwiseCorrelationStats(pairs, region, scale, options) {
    var images = [];

    pairs.forEach(function(pair, index) {
      var xRaw = ee.Image(pair.imageA).select([pair.bandA]);
      var yRaw = ee.Image(pair.imageB).select([pair.bandB]);

      // Use the pairwise valid mask so the batched formula matches pairwise Pearson logic.
      var x = xRaw.updateMask(yRaw.mask()).rename('x_' + index);
      var y = yRaw.updateMask(xRaw.mask()).rename('y_' + index);

      images.push(x);
      images.push(y);
      images.push(x.multiply(x).rename('x2_' + index));
      images.push(y.multiply(y).rename('y2_' + index));
      images.push(x.multiply(y).rename('xy_' + index));
    });

    return ee.Image.cat(images).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      crs: options.crs,
      scale: scale,
      maxPixels: options.maxPixels,
      tileScale: options.tileScale
    });
  }

  // Convert the batched means into Pearson correlation for a certain pair.
  function correlationFromPairStats(stats, index) {
    stats = ee.Dictionary(stats);
    var meanX = ee.Number(stats.get('x_' + index));
    var meanY = ee.Number(stats.get('y_' + index));
    var meanX2 = ee.Number(stats.get('x2_' + index));
    var meanY2 = ee.Number(stats.get('y2_' + index));
    var meanXY = ee.Number(stats.get('xy_' + index));

    var covariance = meanXY.subtract(meanX.multiply(meanY));
    var varianceX = meanX2.subtract(meanX.multiply(meanX));
    var varianceY = meanY2.subtract(meanY.multiply(meanY));

    return covariance.divide(varianceX.multiply(varianceY).sqrt());
  }

  // Corresponds to MATLAB SpecReg.m:
  // Use the four 10 m bands at 20 m scale as predictors X.
  // Use the six 20 m bands as responses Y and solve a no-intercept regression matrix.
  //
  // MATLAB formula:
  //   M = (S2_Vec * PS_Vec') / (PS_Vec * PS_Vec')
  //
  // GEE uses linearRegression(numX=4, numY=6), returning a 4 x 6 coefficient matrix.
  function getSpectralTransformMatrix(s2_20m, s2_10mTo20m, region, options) {
    var bands = options.bands;
    var regressionInput = ee.Image(s2_10mTo20m).select(bands.s2_10m)
      .addBands(ee.Image(s2_20m).select(bands.s2_20m));

    var fit = regressionInput.reduceRegion({
      reducer: ee.Reducer.linearRegression({
        numX: bands.s2_10m.length,
        numY: bands.s2_20m.length
      }),
      geometry: region,
      crs: options.crs,
      scale: options.scale20,
      maxPixels: options.maxPixels,
      tileScale: options.tileScale
    });

    return ee.Array(fit.get('coefficients'));
  }

  // Apply the 4 x 6 spectral transform matrix to the original 10 m bands.
  // The result is six 10 m predictions of the 20 m bands derived from the 10 m bands.
  function applySpectralTransform(s2_10m, coefficients, options) {
    var bands = options.bands;
    var x = ee.Image(s2_10m).select(bands.s2_10m).toArray().toArray(1);
    var y = ee.Image(coefficients)
      .matrixTranspose()
      .matrixMultiply(x)
      .arrayProject([0])
      .arrayFlatten([bands.s2_20m]);

    return forceScale(y, options.scale10, options);
  }

  // Corresponds to MATLAB SpecTrans_S2.m:
  // 1. Downsample the 10 m bands to 20 m with box/mean aggregation.
  // 2. Estimate the spectral transform matrix at 20 m scale.
  // 3. Apply the matrix back to the 10 m bands to obtain Trans_10m.
  function specTransS2(s2_20m, s2_10m, region, options) {
    var s2_10mTo20m = downsampleMean(
      ee.Image(s2_10m).select(options.bands.s2_10m),
      options.scale20,
      options
    );
    var matrix = getSpectralTransformMatrix(s2_20m, s2_10mTo20m, region, options);

    return {
      image: applySpectralTransform(s2_10m, matrix, options),
      coefficientMatrix: matrix,
      s2_10mTo20m: s2_10mTo20m
    };
  }

  // Corresponds to MATLAB SpecCorr.m.
  // Conduct spectral correlation only for RE1/RE2/RE3/NNIR, namely B5/B6/B7/B8A.
  // SWIR1/SWIR2 do not use SpecCorr in the original MATLAB code; they keep SpecTrans_S2 results.
  function specCorrReNnir(s2_20m, s2_10m, s2_10mTo20m, region, options) {
    var images = [];
    var selectedSources = {};
    var correlations = {};
    var targetBands = options.bands.reNnir20m;
    var sourceNames = options.bands.s2_10m;
    var pairs = [];

    targetBands.forEach(function(targetBand) {
      sourceNames.forEach(function(sourceBand) {
        pairs.push({
          imageA: s2_20m,
          bandA: targetBand,
          imageB: s2_10mTo20m,
          bandB: sourceBand
        });
      });
    });

    var stats = pairwiseCorrelationStats(pairs, region, options.scale20, options);

    targetBands.forEach(function(targetBand, targetIndex) {
      var firstIndex = targetIndex * sourceNames.length;
      var bestBandName = sourceNames[0];
      var bestImage = ee.Image(s2_10m).select([sourceNames[0]]);
      var bestCorr = correlationFromPairStats(stats, firstIndex);
      var corrDict = {};
      corrDict[sourceNames[0]] = bestCorr;

      // MATLAB max() keeps the first maximum when values are tied.
      // Use gt(), not gte(), so ties do not replace the current best band.
      for (var i = 1; i < sourceNames.length; i++) {
        var sourceBand = sourceNames[i];
        var corr = correlationFromPairStats(stats, firstIndex + i);
        corrDict[sourceBand] = corr;

        var replace = corr.gt(bestCorr);
        bestImage = ee.Image(ee.Algorithms.If(
          replace,
          ee.Image(s2_10m).select([sourceBand]),
          bestImage
        ));
        bestBandName = ee.String(ee.Algorithms.If(replace, sourceBand, bestBandName));
        bestCorr = ee.Number(ee.Algorithms.If(replace, corr, bestCorr));
      }

      images.push(bestImage.rename([targetBand]));
      selectedSources[targetBand] = bestBandName;
      correlations[targetBand] = ee.Dictionary(corrDict);
    });

    return {
      image: forceScale(ee.Image.cat(images), options.scale10, options),
      selectedSources: ee.Dictionary(selectedSources),
      correlations: ee.Dictionary(correlations)
    };
  }

  // Corresponds to MATLAB BandCombine.m.
  // Only B5/B6/B7/B8A are combined; B11/B12 keep the SpecTrans_S2 result directly.
  function bandCombineReNnir(sim1, sim2, s2_20m, region, options) {
    var images = [];
    var selectedSources = {};
    var correlations = {};
    var targetBands = options.bands.reNnir20m;
    var sim1_LR = downsampleMean(ee.Image(sim1).select(targetBands), options.scale20, options);
    var sim2_LR = downsampleMean(ee.Image(sim2).select(targetBands), options.scale20, options);
    var s2_20mTargets = ee.Image(s2_20m).select(targetBands);
    var pairs = [];

    targetBands.forEach(function(targetBand) {
      pairs.push({
        imageA: sim1_LR,
        bandA: targetBand,
        imageB: s2_20mTargets,
        bandB: targetBand
      });
      pairs.push({
        imageA: sim2_LR,
        bandA: targetBand,
        imageB: s2_20mTargets,
        bandB: targetBand
      });
    });

    var stats = pairwiseCorrelationStats(pairs, region, options.scale20, options);

    targetBands.forEach(function(targetBand, targetIndex) {
      var corr1 = correlationFromPairStats(stats, targetIndex * 2);
      var corr2 = correlationFromPairStats(stats, targetIndex * 2 + 1);

      // MATLAB max([corr1 corr2]) keeps the first candidate when values are tied, so it uses gte().
      var useSim1 = corr1.gte(corr2);
      var selected = ee.Image(ee.Algorithms.If(
        useSim1,
        ee.Image(sim1).select([targetBand]),
        ee.Image(sim2).select([targetBand])
      ));

      images.push(selected.rename([targetBand]));
      selectedSources[targetBand] = ee.String(ee.Algorithms.If(useSim1, 'SpecTrans_S2', 'SpecCorr'));
      correlations[targetBand] = ee.Dictionary({
        SpecTrans_S2: corr1,
        SpecCorr: corr2
      });
    });

    return {
      image: forceScale(ee.Image.cat(images), options.scale10, options),
      selectedSources: ee.Dictionary(selectedSources),
      correlations: ee.Dictionary(correlations)
    };
  }

  // Rebuild the 10-band stack from four original 10 m bands and six sharpened 20 m bands.
  // The output order follows the downstream RASSFM 2.0 convention.
  // B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12.
  function buildFull10BandStack(s2_10m, sharp20To10m, options) {
    var bands = options.bands;
    return ee.Image.cat([
      ee.Image(s2_10m).select(['B2', 'B3', 'B4']),
      ee.Image(sharp20To10m).select(['B5', 'B6', 'B7']),
      ee.Image(s2_10m).select(['B8']),
      ee.Image(sharp20To10m).select(['B8A', 'B11', 'B12'])
    ]).rename(bands.stack10);
  }

  // Main entry point. This function reproduces the MATLAB InterbandSharpenS2.m workflow.
  // It also returns the rebuilt full 10-band stack for downstream processing.
  //
  // Inputs:
  //   args.s2_10m: four 10 m bands, containing B2/B3/B4/B8.
  //   args.s2_20m: six 20 m bands, containing B5/B6/B7/B8A/B11/B12.
  //   args.region: ROI used for regression and correlation statistics.
  //   args.crs: projected CRS, preferably the UTM EPSG of the Sentinel-2 tile.
  //
  // Outputs:
  //   result.image: full 10-band 10 m image.
  //   result.sharpened20m: six 20 m bands sharpened to 10 m.
  //   result.diagnostics: regression matrix and correlation-selection diagnostics.
  function run(args) {
    args = args || {};
    var options = getOptions(args);
    var bands = options.bands;
    var region = args.region;

    if (!region) {
      throw new Error('RASSFM2Interband.run requires args.region.');
    }

    // Standardize input bands, data type, projection, and scale.
    var s2_10m = forceScale(
      ee.Image(args.s2_10m).select(bands.s2_10m).toFloat(),
      options.scale10,
      options
    );
    var s2_20m = forceScale(
      ee.Image(args.s2_20m).select(bands.s2_20m).toFloat(),
      options.scale20,
      options
    );

    // MATLAB:
    //   S2_20mTo10m = imresize(S2_20m, [H_10m W_10m], 'bicubic')
    // This is the bicubic upsampling of the original 20 m bands and acts as the spectral anchor.
    var s2_20mTo10m = upsampleBicubic(s2_20m, options.scale10, options);

    // MATLAB:
    //   Trans_10m = SpecTrans_S2(S2_20m, S2_10m)
    // Use the four 10 m bands to linearly predict the six 20 m bands at 10 m.
    var trans = specTransS2(s2_20m, s2_10m, region, options);

    // MATLAB:
    //   Corr_10m_4bds = SpecCorr(S2_20m(:,:,1:4), S2_10m)
    // For B5/B6/B7/B8A, choose the most correlated 10 m band as another candidate.
    var corr = specCorrReNnir(
      s2_20m.select(bands.reNnir20m),
      s2_10m,
      trans.s2_10mTo20m,
      region,
      options
    );

    // MATLAB:
    //   Sim_10m_Combine = BandCombine(...)
    // Select the candidate that better matches the original 20 m band.
    var combined = bandCombineReNnir(
      trans.image.select(bands.reNnir20m),
      corr.image,
      s2_20m.select(bands.reNnir20m),
      region,
      options
    );

    // MATLAB:
    //   Sim_10m = Trans_10m;
    //   Sim_10m(:,:,1:4) = Sim_10m_Combine;
    // B5/B6/B7/B8A use BandCombine results; B11/B12 keep SpecTrans_S2 results.
    var sim_10m = combined.image
      .addBands(trans.image.select(['B11', 'B12']))
      .select(bands.s2_20m);

    // MATLAB:
    //   Sim_20m = imresize(Sim_10m, [H_20m W_20m], 'box');
    //   Sim_20m_Usp = imresize(Sim_20m, [H_10m W_10m], 'bicubic');
    // Downsample the simulated 10 m image to 20 m, then upsample it back to 10 m.
    var sim_20m = downsampleMean(sim_10m, options.scale20, options);
    var sim_20m_Usp = upsampleBicubic(sim_20m, options.scale10, options);

    // MATLAB final formula:
    //   Sharp_10m = Sim_10m + (S2_20mTo10m - Sim_20m_Usp)
    //
    // Meaning:
    //   Sim_10m provides spatial details borrowed from the 10 m bands.
    //   The residual term keeps the result close to the original 20 m spectral trend.
    var sharpenedFloat = forceScale(
      sim_10m.add(s2_20mTo10m.subtract(sim_20m_Usp)).rename(bands.s2_20m),
      options.scale10,
      options
    ).toFloat();

    // Downstream workflows usually need all ten Sentinel-2 bands.
    var full10BandStackFloat = buildFull10BandStack(s2_10m, sharpenedFloat, options).toFloat();

    // Cast the public outputs according to outputType.
    var sharpened = castOutput(sharpenedFloat, options);
    var full10BandStack = castOutput(full10BandStackFloat, options);

    var diagnostics = {
      coefficientMatrix: trans.coefficientMatrix,
      specCorrSelectedSources: corr.selectedSources,
      specCorrCorrelations: corr.correlations,
      bandCombineSelectedSources: combined.selectedSources,
      bandCombineCorrelations: combined.correlations
    };

    if (options.debug) {
      print('RASSFM2 coefficient matrix, 4 x 6', diagnostics.coefficientMatrix);
      print('RASSFM2 SpecCorr selected sources', diagnostics.specCorrSelectedSources);
      print('RASSFM2 SpecCorr correlations', diagnostics.specCorrCorrelations);
      print('RASSFM2 BandCombine selected sources', diagnostics.bandCombineSelectedSources);
      print('RASSFM2 BandCombine correlations', diagnostics.bandCombineCorrelations);
    }

    return {
      image: full10BandStack,
      full10BandStack: full10BandStack,
      sharpened20m: sharpened,
      sim10m: sim_10m.toFloat(),
      diagnostics: diagnostics
    };
  }

  // Simple entry point: return only the full 10-band image.
  // Use this when the module is only one processing step in another script.
  function interbandSharpenS2(args) {
    return run(args).image;
  }

  // S2 20-m band entry point: return only the six sharpened 20 m bands.
  // This output is suited for consistency comparison with the original return values from MATLAB InterbandSharpenS2.m.
  function sharpen20mOnly(args) {
    return run(args).sharpened20m;
  }

  // Convenience entry point for an uploaded 10-band, 10 m GeoTIFF stack.
  // This input has no native 20 m bands, because the six 20 m-related bands are first aggregated back to 20 m.
  // run() is recommended when native 10 m and 20 m inputs are available.
  function fromTenBandStack(args) {
    args = args || {};
    var options = getOptions(args);
    var bands = options.bands;
    var inputBands = args.inputBands || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    var stack = forceScale(
      ee.Image(args.image).select(inputBands, bands.stack10).toFloat(),
      options.scale10,
      options
    );
    // For uploaded single-image stacks, use the image footprint when no ROI is supplied.
    var region = args.region || stack.geometry();

    var s2_10m = stack.select(bands.s2_10m);
    var s2_20m = downsampleMean(stack.select(bands.s2_20m), options.scale20, options);
    var result = run({
      s2_10m: s2_10m,
      s2_20m: s2_20m,
      region: region,
      crs: options.crs,
      scale10: options.scale10,
      scale20: options.scale20,
      maxPixels: options.maxPixels,
      tileScale: options.tileScale,
      debug: options.debug,
      outputType: options.outputType,
      int16Min: options.int16Min,
      int16Max: options.int16Max,
      bandOrder: bands
    });

    result.s2_10m = s2_10m;
    result.s2_20m = s2_20m;
    return result;
  }

  // Build an optional exact ROI from ENVI/GDAL upper-left coordinate, row/column counts, and pixel size.
  // Use this only when strict pixel dimensions are needed for validation or reproducible exports.
  // For normal use, passing a drawn/uploaded ROI or image.geometry() is simpler.
  function makeHeaderRegion(args) {
    args = args || {};
    var crs = args.crs || 'EPSG:32650';
    var scale = args.scale || 10;
    var xmin = args.xmin;
    var ymax = args.ymax;
    var xmax = xmin + args.cols * scale;
    var ymin = ymax - args.rows * scale;

    return ee.Geometry.Rectangle([xmin, ymin, xmax, ymax], crs, false);
  }

  // Public functions exposed to the GEE Code Editor.
  return {
    interbandSharpenS2: interbandSharpenS2,
    sharpen20mOnly: sharpen20mOnly,
    run: run,
    fromTenBandStack: fromTenBandStack,
    makeHeaderRegion: makeHeaderRegion,
    buildFull10BandStack: function(s2_10m, sharp20To10m, options) {
      return buildFull10BandStack(s2_10m, sharp20To10m, getOptions(options));
    }
  };
})();

// These exports are used by require() when the file is saved as a GEE script module.
// If the file is pasted directly into Code Editor, use the RASSFM2Interband variable instead.
if (typeof exports !== 'undefined') {
  exports.interbandSharpenS2 = RASSFM2Interband.interbandSharpenS2;
  exports.sharpen20mOnly = RASSFM2Interband.sharpen20mOnly;
  exports.run = RASSFM2Interband.run;
  exports.fromTenBandStack = RASSFM2Interband.fromTenBandStack;
  exports.makeHeaderRegion = RASSFM2Interband.makeHeaderRegion;
  exports.buildFull10BandStack = RASSFM2Interband.buildFull10BandStack;
}
