var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

function unescapeHtml(safe) {
  return safe.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

module.exports = {
  
  name: 'TruyenTranhTuan',
  website: 'http://truyentranhtuan.com',

  match: function(link, options) {
    return /truyentranhtuan\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranhTuan');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#viewer').length) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page:', page.url);
      
      page.title = $('title').first().text();
      if (page.title) {
        page.title = page.title.replace(/(\r\n|\n|\r)/gm, '');
      }

      // var chapter_title = $('#read-title').text();
      var chapter_title = page.title.replace(' - Truyện tranh online - truyentranhtuan.com','');
      if (options.debug) console.log('Chapter title: ' + chapter_title);

      var chapter_script = '';
      $('script').each(function() {
        chapter_script += $(this).html();
      });

      if (!chapter_script) {
        if (options.debug) console.log('No chapter images.');
        return callback();
      }

      var slides_type = 1;
      var tmp = utils.extractSubstring(chapter_script, 'var slides_page_path = [', '];');
      if (tmp == '') {
        slides_type = 2;
        tmp = utils.extractSubstring(chapter_script, 'var slides_page_url_path = [', '];');
      }
      // tmp = utils.replaceAll(tmp,'"','');
      // var tmp_images = tmp.split(",");
      
      tmp = utils.replaceAll(tmp, "amp;amp;", "amp;");
      tmp = '{"slides":[' + tmp + ']}'; 
      var tmp_images = [];
      try {
        var obj = JSON.parse(tmp);
        if (obj && obj.slides) {
          tmp_images = obj.slides;
          tmp_images = tmp_images.map(function(image_src) {
            return utils.replaceAll(image_src, "&amp;", "&");
          });
        }
      } catch(e){
      }

      if (slides_type == 1) {
        tmp_images.sort();
      }

      var image_file_names = [];
      var chapter_images = [];
      tmp_images.forEach(function(image_src) {
        var image_url = unescapeHtml(image_src);
        var image_url_obj = urlutil.parse(image_url);
        var image_file_name = path.basename(image_url_obj.pathname);
        if (image_file_name && image_file_name != '') {
          image_file_name = saver.getUniqueFileName(image_file_names, image_file_name);
          chapter_images.push({
            src: image_url,
            file: image_file_name
          });
        }
      });
      if (options.debug) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);

    } else if ($('#manga-chapter').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#infor-box h1[itemprop="name"]').first().text().trim();
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');
      
      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = this.getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }
      
      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '#manga-chapter');

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('#manga-chapter').length) {
      manga_info.url = page.url;
      manga_info.name = $('h1[itemprop="name"]').text();
      manga_info.cover_image = $('.manga-cover img').attr('src');
      manga_info.description = $('#manga-summary').text().trim();

      $('.misc-infor').each(function() {
        var info = $(this).text();
        var info_key = '';
        var info_value = '';
        var info_kv = info.split(':');
        if (info_kv.length > 1) {
          info_key = info_kv[0];
          info_value = info_kv[1];
        }
        info_key = utils.replaceAll(info_key.trim(),'\n','').trim();
        info_value = utils.replaceAll(info_value.trim(),'\n','').trim();

        if (info_key == 'Tác giả' || info_key == 'Thể loại') return;
        if (info_key == 'Tên khác') {
          if (info_value != '') {
            manga_info.alt_names = info_value.split('; ');
          }
        } else if (info_key == 'Chương mới nhất') {
          var tmp_arr = info_value.split('-');
          if (tmp_arr.length>1) {
            manga_info.status = tmp_arr[1].trim();
          }
        } else {
          manga_info[info_key] = info_value;
        }
      });

      manga_info.authors = [];
      $('.misc-infor span[itemprop="author"]').each(function() {
        var author_name = $(this).text().trim();
        author_name = utils.replaceAll(author_name,'\n','');
        manga_info.authors.push(author_name.trim());
      });

      manga_info.genres = [];
      $('.misc-infor a[itemprop="genre"]').each(function() {
        var genre_name = $(this).text().trim();
        genre_name = utils.replaceAll(genre_name,'\r\n','');
        manga_info.genres.push(genre_name.trim());
      });

      var manga_chapters = [];
      var group_names = [];
      var chapter_dates = [];
      $('#manga-chapter .chapter-name a').each(function() {
        manga_chapters.push({
          url: $(this).attr('href'),
          title: $(this).text()
        });
      });
      $('#manga-chapter .group-name').each(function() {
        group_names.push($(this).text())
      });
      $('#manga-chapter .date-name').each(function() {
        chapter_dates.push($(this).text());
      });
      if (manga_chapters.length == chapter_dates.length) {
        for (var i = 0; i < manga_chapters.length; i++) {
          manga_chapters[i].published_date_str = chapter_dates[i];
        }
      }

      manga_info.chapter_count = manga_chapters.length;
          
      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }

      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        console.log('    Authors: ' + manga_info.authors);
        console.log('    Genres: ' + manga_info.genres);
        console.log('    Status: ' + manga_info.status);
        console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
