# Sentinel-2-Interband-Sharpening_GEE
This release provides the Google Earth Engine (GEE) implementation of the Sentinel-2 Inter-band Sharpening module developed as a core component of RASSFM 2.0. The module is designed to downscale the six 20-m Sentinel-2 bands (B5, B6, B7, B8A, B11, and B12) to 10-m resolution by exploiting spatial information contained in the native 10-m bands while preserving the original spectral characteristics.
The resulting sharpened bands can be directly integrated into various downstream Earth observation applications, e.g., land cover mapping, vegetation monitoring, wetland analysis, and water resource assessment, that require both fine spatial details and rich spectral information.
It's adaptive, efficient, and training-free, which can be run in Google Earth Engine conveniently. Code link: https://code.earthengine.google.com/f42ccc8ac213523cfada1a039702844b

<img width="4320" height="2112" alt="Picture10" src="https://github.com/user-attachments/assets/04042387-3acb-4e7e-9b19-58f20c5d5121" />

Code Version 1.0: May 31, 2026.

References:
===================================================================================================================================================================
Yongquan Zhao, Desheng Liu, Xiaolin Zhu, Ming Luo, Bo Huang, Chunqiao Song, Xuejun Duan. 2026. RASSFM 2.0: An enhanced M2Msharpening model for blending PlanetScope and Sentinel-2 imagery across broad landscapes and improved land cover classification. Remote Sensing of Environment, 338, 115371. doi: 10.1016/j.rse.2026.115371

Copyright and License
===================================================================================================================================================================
Copyright (c) 2026 Yongquan Zhao, Ningjing Institute of Geography and Limnology, Chinese Academy of Sciences (NIGLAS).

This repository is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) license.
