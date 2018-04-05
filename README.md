# jul11co-mangadl
Jul11Co's Web Manga Downloader - Download manga from websites.

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
- fanfox.net
- mangahere.cc
- mangakakalot.com
- mangapanda.com
- mangapark.me
- mangareader.net
- mangastream.com
- mangatown.com
- mangazuki.co
- merakiscans.com
- psychoplay.co
- blogtruyen.com
- comicvn.net
- dammetruyen.com
- hocvientruyentranh.com
- mangak.net
- nettruyen.com
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

MIT License

Copyright (c) 2018 Jul11Co

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
