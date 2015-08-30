hash-brunch
=============

A [Brunch][] plugin which hashes and renames generated files and generates a digest.
The hashing works incremental and looks at the file-names in `public/assets` so it works best if there are no other files sitting there.

##### What is does:
1. deletes files in public/assets that aren't in the src-asset folder or .css, .js, or .map
2. generates hash and renames files (incremental, `brunch watch` compatible) 
3. calculates image-sizes (useful for setting image-dimensions which increases [PageSpeed][])
4. renames assets referenced in `css-urls` to their new name
5. renames sourcemaps (this will be probably removed)
6. write file-mapping and image-sizes to `../asset-manifest.json`
    ````
    "img/btn_reset.png": {
        "url": "img/btn_reset-cd43a189.png",
        "imgSize": [67, 22]   
    }
    ...
   ````

##### Problems:
* Breaks css auto-reload (will fix that)
* Manifest-location not configurable
* The incremental hashing algorithm won't delete files that match a filename in `app/assets` with a fingerprint on them.
   
    Example: If there's a file `btn.png` in src and there are `btn-x123456.png` and `btn-x78930-png` in output, those files won't be deleted.

* The hashing algorithm could get confused about files with a different fingerprint-format on them.


Installation
-------
`npm install hash-brunch --save-dev`

Configuration
-------
```coffeescript
exports.config =
  # ...
  plugins:
    hashbrunch:
      # Src-Asset folder
      assets: "app/assets"
```

License
-------

LGPL-2.1

[Brunch]: http://brunch.io

[PageSpeed]: https://developers.google.com/speed/docs/insights/OptimizeImages
