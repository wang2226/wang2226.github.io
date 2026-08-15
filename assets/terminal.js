/* A small interactive shell for brucehrwang.com. Vanilla, no dependencies. */
(function () {
  "use strict";

  var scrollback = document.getElementById("scrollback");
  var promptLine = document.getElementById("prompt-line");
  var promptLabel = document.getElementById("prompt-label");
  var rendered = document.getElementById("rendered");
  var input = document.getElementById("term-input");
  var terminal = document.getElementById("terminal");
  var overlay = document.getElementById("overlay");
  var chips = document.getElementById("chips");

  var HISTORY_KEY = "brucehrwang.terminal.history";
  var HISTORY_MAX = 100;
  var USER = "bruce";
  var HOST = "brucehrwang";
  var HOME = "/home/bruce";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- output */

  function span(text, cls) {
    var s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  }

  function link(text, href, external) {
    var a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (external) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    return a;
  }

  function print(content, cls) {
    var div = document.createElement("div");
    div.className = cls ? "line " + cls : "line";
    if (typeof content === "string") {
      div.textContent = content;
    } else if (Array.isArray(content)) {
      content.forEach(function (part) {
        div.appendChild(typeof part === "string" ? document.createTextNode(part) : part);
      });
    } else if (content) {
      div.appendChild(content);
    }
    scrollback.appendChild(div);
    scrollToBottom();
    return div;
  }

  function printLines(lines, cls) {
    lines.forEach(function (l) {
      print(l, cls);
    });
  }

  function printArt(art, cls) {
    printLines(art.replace(/^\n/, "").replace(/\n$/, "").split("\n"), cls || "green");
  }

  function scrollToBottom() {
    scrollback.scrollTop = scrollback.scrollHeight;
  }

  var columnCache = 0;
  window.addEventListener("resize", function () {
    columnCache = 0;
  });

  /* How many monospace characters fit across the scrollback, so ASCII art and
     cowsay balloons can shrink instead of wrapping into nonsense on phones. */
  function columns() {
    if (columnCache) return columnCache;
    var probe = document.createElement("span");
    probe.textContent = repeat("M", 40);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    scrollback.appendChild(probe);
    var charWidth = probe.getBoundingClientRect().width / 40;
    scrollback.removeChild(probe);
    columnCache = charWidth ? Math.max(20, Math.floor(scrollback.clientWidth / charWidth)) : 80;
    return columnCache;
  }

  /* ------------------------------------------------------------ filesystem */

  var BLOGS = [
    {
      slug: "sahale",
      title: "Cascade Pass to Sahale Camp",
      meta: "North Cascades, Washington · August 2025",
      teaser:
        "A demanding 12-mile round trip from Cascade Pass to Sahale Glacier Camp, climbing about 4,000 feet past wildflower meadows and turquoise Doubtful Lake.",
    },
    {
      slug: "parkbutte",
      title: "Park Butte Lookout",
      meta: "Mount Baker, Washington · August 2025",
      teaser:
        "A 7.5-mile round trip climbing about 2,200 feet through forest, meadows, and boulder fields to a historic fire lookout under Mount Baker.",
    },
    {
      slug: "hiddenlake",
      title: "Hidden Lake Lookout",
      meta: "North Cascades, Washington · July 2025",
      teaser:
        "An 8-mile round trip gaining roughly 3,300 feet through forest, wildflower meadows, and rocky alpine slopes to the lookout above Hidden Lake.",
    },
    {
      slug: "muir",
      title: "Hike to Camp Muir",
      meta: "Mount Rainier, Washington · July 2025",
      teaser:
        "Hiking to Camp Muir, the rugged base camp at 10,188 feet on Mount Rainier, climbing through snowfields and shifting clouds.",
    },
    {
      slug: "sunrise",
      title: "Biking Sunrise Road",
      meta: "Mount Rainier, Washington · June 2025",
      teaser:
        "Riding Sunrise Road in Mount Rainier National Park car-free: a 28-mile round trip with 3,083 feet of climbing.",
    },
    {
      slug: "colorado",
      title: "Ski Colorado",
      meta: "Breckenridge, Colorado · January 2024",
      teaser:
        "A first ski trip to Colorado, exploring Vail, Breckenridge, and Keystone, where the Bergman lift leads to a 12,000-foot peak.",
    },
    {
      slug: "maroon",
      title: "Maroon Bells",
      meta: "Aspen, Colorado · August 2023",
      teaser:
        "Exploring the Maroon Bells above Maroon Creek Valley near Aspen, along with the Crater Lake Trail and the John Denver Sanctuary.",
    },
    {
      slug: "christmas",
      title: "Christmas 2022 Ski Trip",
      meta: "Salt Lake City, Utah · December 2022",
      teaser:
        "A Christmas ski trip to Utah with early-season powder at Alta, Snowbird, Brighton, and Snowbasin.",
    },
    {
      slug: "glacier",
      title: "Bike Going-to-the-Sun Road",
      meta: "Glacier National Park, Montana · July 1, 2022",
      teaser:
        "A 23.22-mile ride with 1,827 feet of climbing on Going-to-the-Sun Road while the upper road was still closed to cars.",
    },
    {
      slug: "utah",
      title: "Ski Utah",
      meta: "Utah · March 2022",
      teaser:
        "Skiing Snowbird, Alta, Deer Valley, Park City, and Powder Mountain, including a first snowcat ride off Lightning Ridge.",
    },
    {
      slug: "montana",
      title: "Ski Montana",
      meta: "Bridger and Big Sky, Montana · 2021–22 season",
      teaser:
        "A tribute to a 69-day ski season based in Bozeman, from the ridge at Bridger to a May ski tour at Beehive Basin.",
    },
    {
      slug: "teton",
      title: "Biking Grand Teton National Park",
      meta: "Grand Teton National Park, Wyoming · August 14, 2021",
      teaser:
        "Riding the paved bike trail that runs from Jenny Lake to Jackson, separated from the park road the whole way.",
    },
    {
      slug: "wheeler",
      title: "Summiting Wheeler Peak in Nevada",
      meta: "Great Basin National Park, Nevada · July 3, 2021",
      teaser:
        "Camping at the 10,000-foot trailhead and climbing Wheeler Peak, crossing a scree field and scrambling the final steep stretch to a 13er summit.",
    },
    {
      slug: "hood",
      title: "Hiking and Summer Skiing on Mount Hood",
      meta: "Mount Hood, Oregon · June 22, 2021",
      teaser:
        "Hiking toward Illumination Rock, camping overnight, and skiing Timberline Lodge in late June.",
    },
    {
      slug: "southsister",
      title: "The False Summit of South Sister",
      meta: "South Sister, Oregon · June 12, 2021",
      teaser:
        "Scouting the snow-covered Summit Trail in June, climbing Lewis Glacier with an ice axe, and turning around at the false summit.",
    },
  ];

  var ABOUT = [
    "Bruce Wang \u2014 @brucehrwang",
    "",
    "I found the outdoors after moving to Eugene, Oregon, and I have been chasing it",
    "ever since: skiing, ski mountaineering, hiking, mountaineering, biking, and",
    "camping, mostly in the Cascades and the Rockies.",
    "",
    "21 national parks and 32 states so far. The goal is to drive all 50.",
    "",
    "I shoot a Canon EOS 5D Mark II with an EF 24-70mm f/2.8L II USM and an",
    "EF 70-200mm f/2.8L IS II USM.",
    "",
    "Favourite drives:",
    "  * U.S. 101, northern California into central Oregon",
    "  * U.S. 1, Miami to Key West",
    "  * Beartooth Highway, Montana / Wyoming",
    "  * Old McKenzie Highway, Oregon",
    "  * Rim Drive, Crater Lake",
    "",
    "There was a Doberman named Nick. He passed away in August 2019, and this corner",
    "of the internet is still a little quieter without him.",
    "",
    "The car is a Subaru, which explains a lot.",
  ];

  var LINKS = [
    { label: "Photography", href: "./photography/portfolio.html", external: false },
    { label: "Adventure Blogs", href: "./blogs/blogs.html", external: false },
    {
      label: "YouTube",
      href: "https://www.youtube.com/channel/UCt2tHvQZmlkzd6xI_DGpMCQ",
      external: true,
    },
    {
      label: "Subiefest Midwest",
      href: "https://www.subiefest.com/midwest/member/91111?car_id=77538&types=car_show&year=2024",
      external: true,
    },
  ];

  function file(opts) {
    return {
      type: "file",
      size: opts.size || 1024,
      date: opts.date || null,
      url: opts.url || null,
      external: !!opts.external,
      cat: opts.cat,
    };
  }

  function blogNode(post) {
    return file({
      size: 2000 + post.slug.length * 137,
      date: shortDate(post.meta),
      url: "./blogs/" + post.slug + ".html",
      cat: function () {
        print("# " + post.title, "bright");
        print(post.meta, "dim");
        print("");
        print(post.teaser);
        print("");
        print([
          span("Run ", "dim"),
          span("open " + post.slug + ".md", "green"),
          span(" to read the whole thing.", "dim"),
        ]);
      },
    });
  }

  /* Blog meta lines end with the location/date, e.g. "... \u00b7 August 14, 2021". */
  function shortDate(meta) {
    var tail = meta.split("\u00b7").pop().trim();
    var month = tail.match(/([A-Z][a-z]{2})[a-z]*\s+(?:\d{1,2},\s*)?(\d{4})/);
    if (month) return month[1] + " " + month[2];
    var season = tail.match(/(\d{4})[\u2013-](\d{2})/);
    if (season) return season[1] + "-" + season[2];
    return tail.slice(0, 12);
  }

  var blogChildren = {};
  BLOGS.forEach(function (post) {
    blogChildren[post.slug + ".md"] = blogNode(post);
  });

  var root = {
    type: "dir",
    children: {
      "about.txt": file({
        size: 1180,
        cat: function () {
          printLines(ABOUT);
        },
      }),
      "links.txt": file({
        size: 640,
        cat: function () {
          LINKS.forEach(function (item) {
            var pad = "  " + item.label + repeat(" ", Math.max(1, 18 - item.label.length));
            print([span(pad, "dim"), link(item.href, item.href, item.external)]);
          });
        },
      }),
      ".secrets": file({
        size: 128,
        cat: function () {
          print("Some commands never made it into help:", "dim");
          print("  sudo   cowsay   fortune   matrix   sl   neofetch", "green");
          print("  ...and a few more. Try the ones you would try on a real box.", "dim");
        },
      }),
      photography: {
        type: "dir",
        url: "./photography/portfolio.html",
        children: {
          "portfolio.html": file({
            size: 8400,
            url: "./photography/portfolio.html",
            cat: function () {
              print("Photographs from the mountains, the road, and everywhere between.");
              print("");
              print([
                span("  ", null),
                link("./photography/portfolio.html", "./photography/portfolio.html", false),
              ]);
            },
          }),
          "gear.txt": file({
            size: 210,
            cat: function () {
              print("Body   Canon EOS 5D Mark II");
              print("Lens   Canon EF 24-70mm f/2.8L II USM");
              print("Lens   Canon EF 70-200mm f/2.8L IS II USM");
            },
          }),
        },
      },
      blogs: {
        type: "dir",
        url: "./blogs/blogs.html",
        children: blogChildren,
      },
    },
  };

  function repeat(str, n) {
    return n > 0 ? new Array(n + 1).join(str) : "";
  }

  /* ------------------------------------------------------------ path logic */

  var cwd = [];
  var prevCwd = [];

  function pathString(parts) {
    return parts.length ? "~/" + parts.join("/") : "~";
  }

  function nodeAt(parts) {
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node.type !== "dir" || !node.children[parts[i]]) return null;
      node = node.children[parts[i]];
    }
    return node;
  }

  /* Resolves a shell-ish path against the cwd. Returns {parts, node, name}. */
  function resolve(arg) {
    var parts;
    var raw = arg == null ? "" : String(arg);
    if (raw === "") {
      parts = cwd.slice();
    } else if (raw === "~" || raw === "/") {
      parts = [];
    } else if (raw.charAt(0) === "~" || raw.charAt(0) === "/") {
      parts = raw.replace(/^[~/]+/, "").split("/");
    } else {
      parts = cwd.concat(raw.split("/"));
    }
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (seg === "" || seg === ".") continue;
      if (seg === "..") {
        out.pop();
        continue;
      }
      out.push(seg);
    }
    return { parts: out, node: nodeAt(out), name: out.length ? out[out.length - 1] : "~" };
  }

  function entries(dirNode, showHidden) {
    return Object.keys(dirNode.children)
      .filter(function (name) {
        return showHidden || name.charAt(0) !== ".";
      })
      .sort();
  }

  /* ---------------------------------------------------------------- output */

  function currentDate() {
    var d = new Date();
    var months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
    return months[d.getMonth()] + " " + d.getDate() + " " + d.getFullYear();
  }

  function notFound(cmd, target, message) {
    print(cmd + ": " + target + ": " + message, "error");
  }

  /* -------------------------------------------------------------- commands */

  var commands = {};

  function define(name, spec) {
    spec.name = name;
    commands[name] = spec;
  }

  define("help", {
    group: "shell",
    summary: "show this list",
    run: function () {
      var groups = [
        ["navigating", ["ls", "cd", "pwd", "tree"]],
        ["reading", ["cat", "open", "search"]],
        ["shell", ["help", "history", "clear", "echo", "exit"]],
        ["system", ["whoami", "date", "uname"]],
      ];
      print("brucehrwang shell \u2014 a small tour of my corner of the internet.", "bright");
      print("");
      groups.forEach(function (group) {
        print(group[0], "green");
        group[1].forEach(function (name) {
          var cmd = commands[name];
          print("  " + name + repeat(" ", Math.max(1, 10 - name.length)) + cmd.summary);
        });
        print("");
      });
      print([
        span("Start with ", "dim"),
        span("ls", "green"),
        span(", then ", "dim"),
        span("cat about.txt", "green"),
        span(" or ", "dim"),
        span("cd blogs", "green"),
        span(".", "dim"),
      ]);
      print(
        "Not everything is listed here. Poke around \u2014 real shells keep secrets too.",
        "dim"
      );
    },
  });

  define("ls", {
    group: "navigating",
    summary: "list files (-a, -l)",
    run: function (ctx) {
      var flags = "";
      var target = null;
      ctx.args.forEach(function (arg) {
        if (arg.charAt(0) === "-" && arg.length > 1) flags += arg.slice(1);
        else if (target === null) target = arg;
      });
      var showHidden = flags.indexOf("a") !== -1;
      var longForm = flags.indexOf("l") !== -1;
      var found = resolve(target);
      if (!found.node) return notFound("ls", target, "No such file or directory");
      if (found.node.type === "file") return print(found.name);

      var names = entries(found.node, showHidden);
      if (showHidden) names = [".", ".."].concat(names);

      if (!longForm) {
        var parts = [];
        names.forEach(function (name, i) {
          var node = name === "." || name === ".." ? { type: "dir" } : found.node.children[name];
          var isDir = node.type === "dir";
          parts.push(span(isDir ? name + "/" : name, isDir ? "dir" : null));
          if (i < names.length - 1) parts.push("  ");
        });
        return print(parts);
      }

      print("total " + names.length, "dim");
      names.forEach(function (name) {
        var node = name === "." || name === ".." ? { type: "dir" } : found.node.children[name];
        var isDir = node.type === "dir";
        var size = isDir ? 96 : node.size;
        var date = (!isDir && node.date) || currentDate();
        print([
          span(
            (isDir ? "drwxr-xr-x" : "-rw-r--r--") +
              "  " +
              USER +
              "  staff  " +
              padLeft(String(size), 6) +
              "  " +
              padLeft(date, 12) +
              "  ",
            "dim"
          ),
          span(isDir ? name + "/" : name, isDir ? "dir" : null),
        ]);
      });
    },
  });

  function padLeft(str, n) {
    return repeat(" ", Math.max(0, n - str.length)) + str;
  }

  define("cd", {
    group: "navigating",
    summary: "change directory",
    run: function (ctx) {
      var arg = ctx.args[0];
      var next;
      if (arg == null) {
        next = { parts: [], node: root };
      } else if (arg === "-") {
        next = { parts: prevCwd.slice(), node: nodeAt(prevCwd) };
      } else {
        next = resolve(arg);
      }
      if (!next.node) return notFound("cd", arg, "no such file or directory");
      if (next.node.type !== "dir") return notFound("cd", arg, "not a directory");
      prevCwd = cwd;
      cwd = next.parts;
      if (arg === "-") print(pathString(cwd), "dim");
      updatePrompt();
    },
  });

  define("pwd", {
    group: "navigating",
    summary: "print working directory",
    run: function () {
      print(cwd.length ? HOME + "/" + cwd.join("/") : HOME);
    },
  });

  define("tree", {
    group: "navigating",
    summary: "show the tree from here",
    run: function (ctx) {
      var found = resolve(ctx.args[0]);
      if (!found.node) return notFound("tree", ctx.args[0], "No such file or directory");
      if (found.node.type === "file") return print(found.name);
      print(pathString(found.parts) + "/", "dir");
      var dirs = 0;
      var files = 0;
      (function walk(node, prefix) {
        var names = entries(node, false);
        names.forEach(function (name, i) {
          var child = node.children[name];
          var last = i === names.length - 1;
          var isDir = child.type === "dir";
          if (isDir) dirs++;
          else files++;
          print([
            span(prefix + (last ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 "), "dim"),
            span(isDir ? name + "/" : name, isDir ? "dir" : null),
          ]);
          if (isDir) walk(child, prefix + (last ? "    " : "\u2502   "));
        });
      })(found.node, "");
      print("");
      print(dirs + " directories, " + files + " files", "dim");
    },
  });

  define("cat", {
    group: "reading",
    summary: "read a file",
    run: function (ctx) {
      if (!ctx.args.length) return print("usage: cat <file>", "warn");
      ctx.args.forEach(function (arg) {
        var found = resolve(arg);
        if (!found.node) return notFound("cat", arg, "No such file or directory");
        if (found.node.type === "dir") return notFound("cat", arg, "Is a directory");
        found.node.cat();
      });
    },
  });

  define("open", {
    group: "reading",
    summary: "open a page in the browser",
    run: function (ctx) {
      var arg = ctx.args[0];
      if (!arg) return print("usage: open <file|slug|url>", "warn");

      if (/^https?:\/\//i.test(arg)) return navigate(arg, true);

      var found = resolve(arg);
      if (found.node && found.node.url) return navigate(found.node.url, found.node.external);
      if (found.node) {
        print("open: " + arg + ": no page for this file. Try `cat " + arg + "`.", "warn");
        return;
      }

      var slug = arg.replace(/\.(md|html)$/, "");
      var post = BLOGS.filter(function (p) {
        return p.slug === slug;
      })[0];
      if (post) return navigate("./blogs/" + post.slug + ".html", false);

      notFound("open", arg, "No such file or directory");
    },
  });

  function navigate(url, external) {
    print([span("opening ", "dim"), span(url, "green"), span(" ...", "dim")]);
    if (external) window.open(url, "_blank", "noopener");
    else window.location.href = url;
  }

  define("search", {
    group: "reading",
    summary: "search pages, posts, and photos (also ⌘K)",
    run: function (ctx) {
      if (typeof window.openSitePalette === "function") {
        window.openSitePalette();
        var input = document.querySelector(".palette__input");
        if (input && ctx.args.length) {
          input.value = ctx.args.join(" ");
          input.dispatchEvent(new Event("input"));
        }
        return;
      }
      print("search: palette is not loaded on this page.", "warn");
    },
  });

  define("whoami", {
    group: "system",
    summary: "who is behind this",
    run: function () {
      print(USER, "bright");
      print("");
      print("Bruce Wang. Skis, hikes, climbs, and bikes, mostly in the");
      print("Cascades and the Rockies. 21 national parks, 32 states, 50 is the plan.");
      print("Shoots a Canon 5D Mark II. Drives a Subaru.");
      print("");
      print([span("More: ", "dim"), span("cat about.txt", "green")]);
    },
  });

  define("date", {
    group: "system",
    summary: "current date and time",
    run: function () {
      print(new Date().toString());
    },
  });

  define("uname", {
    group: "system",
    summary: "system information (-a)",
    run: function (ctx) {
      if (ctx.args.indexOf("-a") !== -1) {
        print(
          "Cascadia " +
            HOST +
            ".com 4.0.0 #1 SMP static-site x86_64 GNU/HTML \u2014 built by hand, no build step"
        );
      } else {
        print("Cascadia");
      }
    },
  });

  define("echo", {
    group: "shell",
    summary: "print a line of text",
    run: function (ctx) {
      print(ctx.rest.replace(/^["'](.*)["']$/, "$1"));
    },
  });

  define("history", {
    group: "shell",
    summary: "commands you have run",
    run: function () {
      if (!history.length) return print("no history yet", "dim");
      history.forEach(function (line, i) {
        print([span(padLeft(String(i + 1), 4) + "  ", "dim"), span(line)]);
      });
    },
  });

  define("clear", {
    group: "shell",
    summary: "clear the screen (Ctrl+L)",
    run: function () {
      scrollback.textContent = "";
    },
  });

  define("exit", {
    group: "shell",
    summary: "close the session",
    run: function () {
      print("");
      print("Connection to " + HOST + ".com closed.", "bright");
      print("Thanks for stopping by. See you on a ridge somewhere.", "dim");
      print("");
      print("[reload the page to reconnect]", "warn");
      shutdown();
    },
  });

  /* ---------------------------------------------------------- easter eggs */

  define("sudo", {
    hidden: true,
    run: function (ctx) {
      print("Nice try.", "bright");
      print(
        USER + " is not in the sudoers file. This incident has been reported.",
        "error"
      );
      if (ctx.args.length) print("(" + ctx.rest + " was never going to happen)", "dim");
    },
  });

  define("cowsay", {
    hidden: true,
    run: function (ctx) {
      var text = ctx.rest || "A life outdoors is a life well lived.";
      printLines(cowsay(text), "green");
    },
  });

  function wrapText(text, width) {
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      while (word.length > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += " " + word;
      else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function cowsay(text) {
    var lines = wrapText(text, Math.max(12, Math.min(38, columns() - 4)));
    var width = lines.reduce(function (max, l) {
      return Math.max(max, l.length);
    }, 0);
    var out = [" " + repeat("_", width + 2)];
    if (lines.length === 1) {
      out.push("< " + padRight(lines[0], width) + " >");
    } else {
      lines.forEach(function (l, i) {
        var left = i === 0 ? "/" : i === lines.length - 1 ? "\\" : "|";
        var right = i === 0 ? "\\" : i === lines.length - 1 ? "/" : "|";
        out.push(left + " " + padRight(l, width) + " " + right);
      });
    }
    out.push(" " + repeat("-", width + 2));
    return out.concat(String.raw`        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||`.split("\n"));
  }

  function padRight(str, n) {
    return str + repeat(" ", Math.max(0, n - str.length));
  }

  var FORTUNES = [
    "A life outdoors is a life well lived.",
    "The mountains are calling and I must go. \u2014 John Muir",
    "It is not the mountain we conquer, but ourselves. \u2014 Edmund Hillary",
    "In every walk with nature one receives far more than he seeks. \u2014 John Muir",
    "The best view comes after the hardest climb.",
    "There is no bad weather, only bad layering.",
    "Take only pictures, leave only footprints, bring extra snacks.",
    "The summit is optional. The trailhead parking lot is not.",
    "Powder days are a valid reason to reschedule anything.",
    "You will be tired tomorrow either way. Might as well go.",
    "Today is the tomorrow you worried about yesterday.",
    "UNIX is user friendly. It is just picky about its friends.",
    "Never trust a computer you cannot throw out a window. \u2014 Steve Wozniak",
    "Real programmers do not comment their code. If it was hard to write, it should be hard to read.",
    "Beware of bugs in the above code; I have only proved it correct, not tried it. \u2014 Donald Knuth",
  ];

  define("fortune", {
    hidden: true,
    run: function () {
      print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], "green");
    },
  });

  define("neofetch", {
    hidden: true,
    run: function () {
      var logo = String.raw`        /\
       /  \
      /    \        /\
     /  /\  \      /  \
    /  /  \  \    /    \
   /  /    \  \  /  /\  \
  /__/      \__\/__/  \__\ `.split("\n");
      var res = window.screen ? window.screen.width + "x" + window.screen.height : "unknown";
      var info = [
        [USER + "@" + HOST, ""],
        ["-----------------", ""],
        ["OS", "Cascadia (static site)"],
        ["Host", "GitHub Pages"],
        ["Shell", "brucesh 1.0"],
        ["Engine", navigator.userAgent.indexOf("Firefox") !== -1 ? "Gecko" : "Blink/WebKit"],
        ["Resolution", res],
        ["Terminal", "index.html"],
        ["Packages", BLOGS.length + " trip reports"],
        ["Uptime", Math.round(performance.now() / 1000) + "s"],
        ["Parks", "21 national parks, 32 states"],
        ["Camera", "Canon EOS 5D Mark II"],
      ];
      var infoLine = function (row) {
        return row[1] ? [span(row[0], "green"), span(": " + row[1])] : [span(row[0], "bright")];
      };

      /* Narrow screens get the logo above the table instead of beside it. */
      if (columns() < 62) {
        printLines(logo, "green");
        info.forEach(function (row) {
          print(infoLine(row));
        });
        return;
      }

      var rows = Math.max(logo.length, info.length);
      for (var i = 0; i < rows; i++) {
        var parts = [span(padRight(logo[i] || "", 30), "green")];
        if (info[i]) parts = parts.concat(infoLine(info[i]));
        print(parts);
      }
    },
  });

  define("coffee", {
    hidden: true,
    run: function () {
      print("HTTP 418: I'm a teapot.", "warn");
      print("No coffee here, but there is a thermos in the car and 4 a.m. is soon.", "dim");
    },
  });

  define("ski", {
    hidden: true,
    run: function () {
      printArt(String.raw`    ___/\___
   /        \
  /  ~~~~~~  \
 /____________\ `);
      print("");
      print("69 days in the 2021-22 season, based in Bozeman.");
      print("Bridger, Big Sky, Alta, Snowbird, Brighton,");
      print("Snowbasin, Vail, Breckenridge, Keystone,");
      print("Deer Valley, Park City, Powder Mountain.");
      print("Timberline in June, because why not.");
      print("");
      print("Skis are already in the car.", "dim");
    },
  });

  var VIM_JOKES = {
    vim: [
      "E1: Cannot exit. You are here now.",
      "(just kidding \u2014 press any key, or type `:wq` if it makes you feel better)",
    ],
    vi: [
      "E1: Cannot exit. You are here now.",
      "(just kidding \u2014 press any key, or type `:wq` if it makes you feel better)",
    ],
    nano: [
      "nano: opening editor... just kidding.",
      "^X to exit, which you already knew, which is why you did not open vim.",
    ],
    emacs: [
      "emacs: a great operating system, lacking only a decent editor.",
      "Loading it would take longer than the hike. Skipping.",
    ],
  };

  Object.keys(VIM_JOKES).forEach(function (name) {
    define(name, {
      hidden: true,
      run: function () {
        printLines(VIM_JOKES[name], "warn");
      },
    });
  });

  define("rm", {
    hidden: true,
    run: function (ctx) {
      var target = ctx.args.join(" ");
      if (!/-[a-z]*r/.test(target) || !/(\s|^)(\/|~)$/.test(target)) {
        print("rm: this is a static site. There is nothing here to delete.", "dim");
        return;
      }
      return fakeDestruction();
    },
  });

  function fakeDestruction() {
    var steps = [
      "rm: descending into /",
      "removing /bin ...",
      "removing /etc ...",
      "removing /home/bruce/photos ... (12,481 files)",
      "removing /home/bruce/blogs ...",
      "removing /home/bruce/skis ...",
    ];
    return sequence(steps, 260, "error").then(function () {
      print("");
      print("just kidding \u2014 it is a static site, everything is still here.", "bright");
      print("Try `ls` if you do not believe me.", "dim");
    });
  }

  function sequence(lines, delay, cls) {
    return lines.reduce(function (chain, line) {
      return chain.then(function () {
        return wait(delay).then(function () {
          print(line, cls);
        });
      });
    }, Promise.resolve());
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  define("konami", {
    hidden: true,
    run: function () {
      konamiUnlock();
    },
  });

  function konamiUnlock() {
    printArt(String.raw`+----------------------------------+
|  30 LIVES GRANTED                |
|  you still have to hike up first |
+----------------------------------+`);
    print("Achievement unlocked: found the cheat code.", "green");
  }

  /* --------------------------------------------------------- animations */

  var animation = null;

  /* setup() runs once the overlay is on screen (so it can measure itself) and
     returns the per-frame draw function. */
  function startOverlay(setup, durationMs) {
    return new Promise(function (resolve) {
      overlay.textContent = "";
      overlay.hidden = false;
      overlay.appendChild(span("[any key to stop]", "overlay-hint"));
      var frame = setup();

      var start = performance.now();
      var rafId = 0;
      var done = false;

      function stop() {
        if (done) return;
        done = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener("keydown", onStop, true);
        overlay.removeEventListener("pointerdown", onStop, true);
        overlay.textContent = "";
        overlay.hidden = true;
        animation = null;
        focusInput();
        resolve();
      }

      function onStop(event) {
        if (event.type === "keydown") event.preventDefault();
        stop();
      }

      function tick(now) {
        if (done) return;
        if (now - start > durationMs) return stop();
        frame(now - start);
        rafId = requestAnimationFrame(tick);
      }

      animation = { stop: stop };
      window.addEventListener("keydown", onStop, true);
      overlay.addEventListener("pointerdown", onStop, true);
      rafId = requestAnimationFrame(tick);
    });
  }

  /* Overlay animations draw into two stacked <pre> grids so the "head" of each
     matrix drop can be brighter without rebuilding a span per character. */
  function overlayGrid() {
    var probe = document.createElement("pre");
    probe.className = "line";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.margin = "0";
    probe.textContent = repeat("M", 100);
    overlay.appendChild(probe);
    var charWidth = probe.getBoundingClientRect().width / 100 || 8;
    var lineHeight = probe.getBoundingClientRect().height || 16;
    overlay.removeChild(probe);

    var box = overlay.getBoundingClientRect();
    var pad = 24;
    return {
      cols: Math.max(8, Math.floor((box.width - pad) / charWidth)),
      rows: Math.max(6, Math.floor((box.height - pad) / lineHeight)),
    };
  }

  function overlayLayer(cls) {
    var pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.position = "absolute";
    pre.style.inset = "var(--term-pad)";
    pre.style.pointerEvents = "none";
    if (cls) pre.className = cls;
    overlay.appendChild(pre);
    return pre;
  }

  var MATRIX_CHARS = "01\u30a2\u30ab\u30b5\u30bf\u30ca\u30cf\u30de\u30e4\u30e9\u30ef abcdefghijklmnopqrstuvwxyz<>/$#*";

  function randomChar() {
    return MATRIX_CHARS.charAt(Math.floor(Math.random() * MATRIX_CHARS.length));
  }

  define("matrix", {
    hidden: true,
    run: function () {
      if (reduceMotion) {
        printArt(staticRain(), "green");
        print("(reduced motion is on, so here is the still frame)", "dim");
        return;
      }
      return startOverlay(function () {
        var grid = overlayGrid();
        var trail = overlayLayer("dim");
        var heads = overlayLayer("bright");
        var drops = [];
        for (var c = 0; c < grid.cols; c++) {
          drops.push({
            y: Math.random() * -grid.rows,
            speed: 0.25 + Math.random() * 0.75,
            len: 4 + Math.floor(Math.random() * 12),
          });
        }
        var last = -100;
        return function (elapsed) {
          if (elapsed - last < 60) return;
          last = elapsed;
          var trailGrid = [];
          var headGrid = [];
          for (var r = 0; r < grid.rows; r++) {
            trailGrid.push(new Array(grid.cols).fill(" "));
            headGrid.push(new Array(grid.cols).fill(" "));
          }
          drops.forEach(function (drop, col) {
            drop.y += drop.speed;
            if (drop.y - drop.len > grid.rows) {
              drop.y = -Math.random() * 10;
              drop.len = 4 + Math.floor(Math.random() * 12);
            }
            var head = Math.floor(drop.y);
            for (var i = 0; i < drop.len; i++) {
              var row = head - i;
              if (row < 0 || row >= grid.rows) continue;
              if (i === 0) headGrid[row][col] = randomChar();
              else trailGrid[row][col] = randomChar();
            }
          });
          trail.textContent = joinGrid(trailGrid);
          heads.textContent = joinGrid(headGrid);
        };
      }, 6000);
    },
  });

  function joinGrid(grid) {
    return grid
      .map(function (row) {
        return row.join("");
      })
      .join("\n");
  }

  function staticRain() {
    var lines = [];
    for (var r = 0; r < 10; r++) {
      var row = "";
      for (var c = 0; c < 48; c++) row += Math.random() < 0.35 ? randomChar() : " ";
      lines.push(row);
    }
    return lines.join("\n");
  }

  var TRAIN = String.raw`      ====        ________                ___________
  _D _|  |_______/        \__I_I_____===__|_________|
   |(_)---  |   H\________/ |   |        =|___ ___|
   /     |  |   H  |  |     |   |         ||_| |_||
  |      |  |   H  |__--------------------| [___] |
  | ________|___H__/__|_____/[][]~\_______|       |
  |/ |   |-----------I_____I [][] []  D   |=======|__
__/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
 |/-=|___|=    ||    ||    ||    |_____/~\___/
  \_/      \O=====O=====O=====O_/      \_/`;

  define("sl", {
    hidden: true,
    run: function () {
      var lines = TRAIN.split("\n");
      var width = lines.reduce(function (max, l) {
        return Math.max(max, l.length);
      }, 0);

      if (reduceMotion) {
        printArt(TRAIN, "green");
        print("(you typed sl instead of ls \u2014 the train still runs)", "dim");
        return;
      }

      var duration = 6000;
      return startOverlay(function () {
        var grid = overlayGrid();
        var layer = overlayLayer("green");
        var blank = repeat("\n", Math.max(0, Math.floor((grid.rows - lines.length) / 2)));

        return function (elapsed) {
          var x = Math.round(grid.cols - (elapsed / duration) * (grid.cols + width));
          layer.textContent =
            blank +
            lines
              .map(function (line) {
                if (x >= 0) return repeat(" ", x) + line.slice(0, Math.max(0, grid.cols - x));
                return line.slice(-x, -x + grid.cols);
              })
              .join("\n");
        };
      }, duration);
    },
  });

  /* ----------------------------------------------------------- execution */

  var history = loadHistory();
  var historyIndex = history.length;
  var busy = false;
  var closed = false;

  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(-HISTORY_MAX) : [];
    } catch (err) {
      return [];
    }
  }

  function saveHistory() {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_MAX)));
    } catch (err) {
      /* private browsing or a full quota: history just stays in memory */
    }
  }

  function tokenize(line) {
    var tokens = [];
    var re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    var match;
    while ((match = re.exec(line))) {
      tokens.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
    }
    return tokens;
  }

  function echoCommand(line) {
    print([span(promptText(), "green"), span(line, "echo")]);
  }

  function promptText() {
    return USER + "@" + HOST + ":" + pathString(cwd) + "$ ";
  }

  function updatePrompt() {
    promptLabel.textContent = promptText();
  }

  function run(line) {
    var trimmed = line.trim();
    echoCommand(line);
    if (!trimmed) return Promise.resolve();

    if (history[history.length - 1] !== trimmed) {
      history.push(trimmed);
      if (history.length > HISTORY_MAX) history.shift();
      saveHistory();
    }
    historyIndex = history.length;

    var tokens = tokenize(trimmed);
    var name = tokens[0];
    var command = commands[name];
    if (!command) {
      print("zsh: command not found: " + name, "error");
      print("Type `help` for the commands that do exist.", "dim");
      return Promise.resolve();
    }

    var ctx = {
      args: tokens.slice(1),
      rest: trimmed.slice(name.length).trim(),
      name: name,
    };

    var result;
    try {
      result = command.run(ctx);
    } catch (err) {
      print(name + ": " + err.message, "error");
      return Promise.resolve();
    }
    return Promise.resolve(result);
  }

  function submit() {
    if (busy || closed) return;
    finishBanner();
    var line = input.value;
    input.value = "";
    renderInput();
    busy = true;
    run(line)
      .catch(function (err) {
        print(String(err && err.message ? err.message : err), "error");
      })
      .then(function () {
        busy = false;
        scrollToBottom();
        focusInput();
      });
  }

  function shutdown() {
    closed = true;
    promptLine.hidden = true;
    input.disabled = true;
  }

  /* --------------------------------------------------------------- input */

  function renderInput() {
    var value = input.value;
    var pos = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
    rendered.textContent = "";
    rendered.appendChild(document.createTextNode(value.slice(0, pos)));
    var cursor = span(value.slice(pos, pos + 1) || " ", "cursor");
    if (document.activeElement !== input) cursor.classList.add("cursor--idle");
    rendered.appendChild(cursor);
    rendered.appendChild(document.createTextNode(value.slice(pos + 1)));
  }

  function focusInput() {
    if (closed) return;
    input.focus({ preventScroll: true });
    renderInput();
  }

  var tabState = null;

  function completionsFor(value) {
    var tokens = value.split(/\s+/);
    var trailingSpace = /\s$/.test(value);
    var word = trailingSpace ? "" : tokens[tokens.length - 1];
    var isFirst = tokens.length === 1 && !trailingSpace;

    if (isFirst) {
      return {
        word: word,
        candidates: Object.keys(commands)
          .filter(function (name) {
            return !commands[name].hidden && name.indexOf(word) === 0;
          })
          .sort(),
        suffix: " ",
      };
    }

    var slash = word.lastIndexOf("/");
    var dirPart = slash === -1 ? "" : word.slice(0, slash + 1);
    var stem = slash === -1 ? word : word.slice(slash + 1);
    var found = resolve(dirPart || ".");
    if (!found.node || found.node.type !== "dir") return { word: word, candidates: [] };

    var names = entries(found.node, stem.charAt(0) === ".").filter(function (name) {
      return name.indexOf(stem) === 0;
    });
    return {
      word: word,
      candidates: names.map(function (name) {
        return dirPart + name + (found.node.children[name].type === "dir" ? "/" : "");
      }),
      suffix: "",
    };
  }

  function commonPrefix(list) {
    if (!list.length) return "";
    return list.reduce(function (prefix, item) {
      var i = 0;
      while (i < prefix.length && i < item.length && prefix[i] === item[i]) i++;
      return prefix.slice(0, i);
    });
  }

  function replaceLastWord(value, replacement) {
    var trailingSpace = /\s$/.test(value);
    if (trailingSpace) return value + replacement;
    return value.replace(/\S*$/, replacement);
  }

  function complete() {
    var value = input.value;

    if (tabState && tabState.value === value) {
      tabState.index = (tabState.index + 1) % tabState.candidates.length;
      var next = tabState.candidates[tabState.index];
      input.value = replaceLastWord(tabState.base, next);
      tabState.value = input.value;
      renderInput();
      return;
    }

    var result = completionsFor(value);
    if (!result.candidates.length) return;

    if (result.candidates.length === 1) {
      var only = result.candidates[0];
      input.value =
        replaceLastWord(value, only) + (/\/$/.test(only) ? "" : result.suffix || " ");
      tabState = null;
      renderInput();
      return;
    }

    var prefix = commonPrefix(result.candidates);
    var expanded = prefix.length > result.word.length ? replaceLastWord(value, prefix) : value;
    input.value = expanded;
    if (prefix.length <= result.word.length) {
      echoCommand(value);
      var parts = [];
      result.candidates.forEach(function (name, i) {
        parts.push(span(name, /\/$/.test(name) ? "dir" : null));
        if (i < result.candidates.length - 1) parts.push("  ");
      });
      print(parts);
    }
    tabState = { base: expanded, value: expanded, candidates: result.candidates, index: -1 };
    renderInput();
  }

  var KONAMI = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  var konamiProgress = 0;

  function trackKonami(key) {
    if (key === KONAMI[konamiProgress]) {
      konamiProgress++;
      if (konamiProgress === KONAMI.length) {
        konamiProgress = 0;
        print("");
        konamiUnlock();
        return true;
      }
    } else {
      konamiProgress = key === KONAMI[0] ? 1 : 0;
    }
    return false;
  }

  input.addEventListener("keydown", function (event) {
    if (closed) return;
    if (trackKonami(event.key)) return;

    if (event.key !== "Tab") tabState = null;

    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }

    /* Only swallow Tab when there is something to complete, so keyboard users
       can always move focus out of the terminal. */
    if (event.key === "Tab" && input.value.trim() && !event.shiftKey) {
      event.preventDefault();
      complete();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!history.length) return;
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || "";
      moveCaretToEnd();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = historyIndex >= history.length ? "" : history[historyIndex];
      moveCaretToEnd();
      return;
    }

    if (event.ctrlKey && (event.key === "l" || event.key === "L")) {
      event.preventDefault();
      scrollback.textContent = "";
      input.value = "";
      renderInput();
      return;
    }

    if (event.ctrlKey && (event.key === "c" || event.key === "C")) {
      event.preventDefault();
      print([span(promptText(), "green"), span(input.value + "^C", "echo")]);
      input.value = "";
      historyIndex = history.length;
      renderInput();
    }
  });

  function moveCaretToEnd() {
    var end = input.value.length;
    input.setSelectionRange(end, end);
    renderInput();
  }

  ["input", "keyup", "click", "focus", "blur", "select"].forEach(function (type) {
    input.addEventListener(type, renderInput);
  });

  /* Focus on click rather than pointerdown so drag-selecting output still works. */
  terminal.addEventListener("click", function (event) {
    if (animation || closed) return;
    if (event.target.closest("a")) return;
    var selection = window.getSelection();
    if (selection && String(selection).length) return;
    focusInput();
  });

  /* ---------------------------------------------------------------- chips */

  [
    { label: "help", command: "help" },
    { label: "ls", command: "ls" },
    { label: "about", command: "cat about.txt" },
    { label: "blogs", command: "cd blogs" },
    { label: "photography", command: "open photography" },
    { label: "neofetch", command: "neofetch" },
  ].forEach(function (chip) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = chip.label;
    button.addEventListener("click", function () {
      if (busy || closed) return;
      input.value = chip.command;
      submit();
    });
    chips.appendChild(button);
  });

  /* ----------------------------------------------------------------- boot */

  var BANNER = [
    { text: "brucehrwang.com \u2014 a little corner of the internet", cls: "green" },
    { text: "", cls: null },
    { text: "Bruce Wang: mountains, skis, cameras, long drives.", cls: null },
    { text: "Type `help` to get started, `ls` to look around, or `search` / ⌘K to find a page.", cls: "bright" },
    { text: "", cls: null },
  ];

  var bannerTimer = null;
  var bannerQueue = BANNER.slice();

  function finishBanner() {
    if (!bannerQueue.length && !bannerTimer) return;
    clearTimeout(bannerTimer);
    bannerTimer = null;
    if (bannerNode && bannerPending) {
      bannerNode.textContent = bannerPending.text;
      bannerNode = null;
      bannerPending = null;
    }
    bannerQueue.forEach(function (item) {
      print(item.text, item.cls);
    });
    bannerQueue = [];
  }

  var bannerNode = null;
  var bannerPending = null;

  function typeBanner() {
    if (!bannerQueue.length) return;
    bannerPending = bannerQueue.shift();
    bannerNode = print("", bannerPending.cls);
    var i = 0;
    (function typeChar() {
      if (!bannerPending) return;
      bannerNode.textContent = bannerPending.text.slice(0, ++i);
      scrollToBottom();
      if (i < bannerPending.text.length) {
        bannerTimer = setTimeout(typeChar, 12);
      } else {
        bannerNode = null;
        bannerPending = null;
        bannerTimer = setTimeout(typeBanner, 60);
      }
    })();
  }

  /* index.html ships the greeting as real markup for crawlers and for anyone
     without JavaScript. The shell is about to type the same thing, so clear it. */
  var boot = document.getElementById("boot");
  if (boot) {
    boot.parentNode.removeChild(boot);
  }

  updatePrompt();
  renderInput();
  typeBanner();
  focusInput();
  window.addEventListener("pageshow", focusInput);
})();
