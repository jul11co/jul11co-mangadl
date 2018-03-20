# jul11co-mangadl
Jul11Co's Web Manga Downloader - Download manga from websites.

[![NPM](https://nodei.co/npm/jul11co-mangadl.png)](https://nodei.co/npm/jul11co-mangadl/)

### Features

* Works on Linux, macOS and Windows. 
* Easy to extend.
* Easy to update/resume.

### Installation

From npm

```
npm install -g jul11co-mangadl
```

### Supports: 

List of supported manga sites:

```
mangadl help --supported-sites
```

- mangadex.org
- mangaeden.com
- mangafox.me
- mangahere.cc
- mangakakalot.com
- mangapanda.com
- mangapark.me
- mangareader.net
- mangastream.com
- mangatown.com
- mangazuki.co
- blogtruyen.com
- comicvn.net
- dammetruyen.com
- mangak.net
- truyen.academyvn.com
- truyentranh8.net
- truyentranh.net
- truyentranhtuan.com
- uptruyen.com
- webtoons.com
- comic.naver.com
- webtoon.bamtoki.com
- and more...

### Usage

```
Usage: mangadl <COMMAND> [OPTIONS...]
```

* Show supported manga sites

```
mangadl help --supported-sites
```

* Download manga to local directory (`download` can be omitted)

```
mangadl [download] <page_url> [output_dir] [--force] [--cbz]
```

* Update local directory

```
mangadl update [output_dir] [--recursive] [--cbz]
```

* Create comicbook archive (CBZ)

```
mangadl archive [output_dir] [--recursive] [--cleanup]
```

* Manga management

```
mangadl list [output_dir]
mangadl add <page_url> [output_dir]
mangadl enable [output_dir]
mangadl disable [output_dir]
```

* Links management

```
mangadl add-link <manga_dir> <page_url> [output_dir]
mangadl remove-link <manga_dir> <page_url>
mangadl enable-link <manga_dir> <page_url>
mangadl disable-link <manga_dir> <page_url>
```

### Extend

```
npm install --save jul11co-mangadl
```

```javascript
var mangadl = require('jul11co-mangadl');

mangadl.addHandler({
	name: 'MangaZZZ',
	match: function(link, options) {
        // ...
        return true;
	},
	dispatch: function(saver, $, page, options, callback) {
		// ...
		// $(...)
		// saver.setStateData(...)
		// saver.getStateData(...)
		// saver.updateStateData(...)
		// saver.getLinks(...)
		// saver.getImages(...)
		// saver.downloadMangaChapter(...)
		// saver.processPage(...)
		// saver.processPages(...)
		// ...
		return callback();
	}
});

var page_url = 'MANGA_URL';
var output_dir = 'OUTPUT_DIR';
var options = {};

mangadl.download(page_url, output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
});
```

### License

Licensed under the Apache License, Version 2.0
(<http://www.apache.org/licenses/LICENSE-2.0>)
