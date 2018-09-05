var path = require('path');
var urlutil = require('url');
var async = require('async');

var utils = require('jul11co-wdt').Utils;

var showGallery = function(bodir,tapdir,pageCount, bookname, chapter) {
  var images = [];
  
  var imageURL = 'http://comicserver.vuilen.com/imagecache/';

  for(var i = 1; i< pageCount ;i++) {

    var imageFile375 = imageURL + 'w375/' +  bodir + '/' + tapdir + '/img/Untitled-' + i + '.jpg';
    var imageFile480 = imageURL + 'w480/' +  bodir + '/' + tapdir + '/img/Untitled-' + i + '.jpg';
    var imageFile757 = imageURL + 'w757/' +  bodir + '/' + tapdir + '/img/Untitled-' + i + '.jpg';

    var imageThumb = imageURL + 'w50/' +  bodir + '/' + tapdir + '/img/Untitled-' + i + '.jpg';

    var srcset = imageFile375 + ' 375w, ' +  imageFile480 + ' 480w,' + imageFile757 + '  757w'
    var sizes = '(min-width: 40em) 80vw, 100vw';
    
    var info = bookname + ' - tap ' + chapter + ' - pages '  + i + ' / ' + (pageCount -1);
    var imageInfo = {
      src: imageFile757, // imageFile480,
      thumb: imageThumb,
      alt: info,
      // subHtml: info,
      // responsive:srcset
    };
    images.push(imageInfo);
  }

  return images;
}

module.exports = {
  
  name: 'Comic.vuilen',
  website: 'http://comic.vuilen.com',

  match: function(link, options) {
    return /comic\.vuilen\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Comic.vuilen');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('http://comic.vuilen.com/viewbook.php') == 0) {
      console.log('----');
      var manga_title = page.title.split('-')[0].trim();
      console.log('Manga title: ' + manga_title);
      console.log('Comic list');

      if (options.auto_manga_dir && !options.manga_dir_changed) {
        options.manga_dir_changed = true;
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      if (!saver.getStateData('url')) {
        saver.setStateData('url', page.url);
      }

      var comics = [];
      $('td.alt1 b').each(function() {
        var $comic = $(this).parent();
        var comic_name = $(this).text().trim();

        var gallery_js = $comic.find('tr td div').eq(0).attr('onclick');
        gallery_js = utils.extractSubstring(gallery_js, 'showGallery(', ')');
        gallery_js = utils.replaceAll(gallery_js, '\'','');

        // console.log(gallery_js);
        if (gallery_js) {

          var gallery_info_array = gallery_js.split(',');
          var bodir = gallery_info_array[0];
          var tapdir = gallery_info_array[1];
          var pageCount = parseInt(gallery_info_array[2]);
          var bookname = gallery_info_array[3];
          var chapter = parseInt(gallery_info_array[4]);

          var images = showGallery(bodir, tapdir, pageCount, bookname, chapter);
          comics.push({
            name: comic_name + ' - ' + chapter,
            // gallery_js: gallery_js,
            bo: bodir,
            tap: tapdir,
            page_count: pageCount,
            book_name: bookname,
            chapter: chapter,
            images: images
          });
        }
      });

      comics = comics.filter(function(comic) {
        return !saver.isDone(comic.name);
      });

      console.log('New comics:', comics.length);

      async.eachSeries(comics, function(comic, cb) {
        saver.downloadMangaChapter({
          chapter_url: comic.name,
          chapter_title: comic.name,
          chapter_images: comic.images,
          output_dir: path.join(options.output_dir, comic.bo + '-' + comic.tap),
          verbose: options.verbose
        }, options, cb);
      }, function(err) {
        if (err) return callback(err);

        var navlinks = saver.getLinks($, page, '.pagenav');
        navlinks = navlinks.filter(function(link) {
          return !saver.isVisited(link);
        });

        // console.log('Nav links:', navlinks.length);

        saver.processPages(navlinks, options, callback);
      });
    } else {
      callback();
    }
  }
}