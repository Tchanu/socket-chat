'use strict';

window.isTyping = false;
window.isTypingTimer = null;
window.voiceEnabled = true;

let notificationSound = new Audio('../media/not.mp3');
let audio = new Audio();

$(function () {
    let socket = io(),
        canvas = document.getElementsByClassName('whiteboard')[0],
        drawing = false,
        context = canvas.getContext('2d'),
        current = {
            color: '#222',
            lineWidth: 2
        };

    $(".msg-block").draggable({
        handle: '.header',
        containment: "canvas"
    }).resizable({
        minHeight: 300,
        minWidth: 330
    });

    onResize();

    function drawLine(x0, y0, x1, y1, color, emit, lineWidth) {
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.stroke();
        context.closePath();

        if (!emit) {
            return;
        }
        let w = canvas.width,
            h = canvas.height;

        socket.emit('drawing', {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color,
            lineWidth: lineWidth
        });
    }

    function drawImage(data) {console.log(data);
        let image = new Image(),
            x = canvas.width * data.x,
            y = canvas.height * data.y;
        image.onload = (function () {
            let w = this.width,
                h = this.height;

            h = canvas.height * data.height;
            w = canvas.width * data.width;

            //downscale
            /*if(this.width > this.height){
                if(this.width > scaled_width){
                    h = this.height * (scaled_width / this.width);
                    w = scaled_width;
                }
            }else{
                if(this.height > scaled_height){
                    h = scaled_height;
                    w = this.width * (scaled_height / this.height);
                }
            }*/

            context.drawImage(this, x, y, w, h);
        });

        image.src = data.src;
    }

    function onMouseDown(e) {
        drawing = true;
        current.x = e.clientX;
        current.y = e.clientY;
    }

    function onMouseUp(e) {
        if (!drawing) {
            return;
        }
        drawing = false;
        drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true, current.lineWidth);
    }

    function onMouseMove(e) {
        if (!drawing) {
            return;
        }
        drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true, current.lineWidth);
        current.x = e.clientX;
        current.y = e.clientY;
    }

    function onDrawingEvent(data) {
        let w = canvas.width,
            h = canvas.height;
        drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, false, data.lineWidth);
    }


    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function endTyping() {
        window.isTyping = false;
        socket.emit('typing', false);
    }

    function call(id) {
        //todo call
    }

    function soundHandler(data) {
        audio.src = data.src;
        if (data.play && audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }


    //--------------------------------key events
    $('form').submit(function () {
        let msg = $('#m').val();
        if (msg.length < 1) return false;
        socket.emit('chat', msg);
        $('#m').val('');
        endTyping();
        return false;
    });

    $('#m').keypress(function (event) {
        if (!window.isTyping) {
            window.isTyping = true;
            socket.emit('typing', true);
        }
        clearTimeout(window.isTypingTimer);
        window.isTypingTimer = setTimeout(endTyping, 2000);
    });

    $('#nameInput').keyup(function (event) {
        let $welcome_btn = $('#welcome .btn');
        if (event.keyCode === 13) {
            $welcome_btn.click();
        }
        if ($(this).val().length > 2) {
            $welcome_btn.show();
        } else {
            $welcome_btn.hide();
        }
    });

    $('#welcome .btn').click(function () {
        socket.emit('auth', $('#nameInput').val());
        $(".msg-block").animate({
            bottom: '30px',
            left: '50px',
            opacity: '1'
        }, 1500);
        $('#welcome').hide();
    })

    //--------------------------------socket events
    socket.on('chat', function (msg) {
        var html = '<li><span style="color:' + msg.color + ';" class="name">' + msg.user + '</span>  ' + msg.data + '</li>';
        $('#messages').append(html);

        let $e = $('#messages');
        if ($e[0].scrollHeight - $e[0].scrollTop < $e.height() + 50) {
            $e[0].scrollTop = $e[0].scrollHeight;
        }

        if (window.voiceEnabled) {
            notificationSound.play();
        }
    });

    socket.on('typing', function (data) {
        if (data.length > 0) {
            $('.is-typing').css('opacity', 1);
            $('#typing_user').html(data.toString());
        } else {
            $('.is-typing').css('opacity', 0);
        }
    })

    socket.on('update-online-users', function (data) {
        //$('#users-panel strong').html(data.length);

        var html = ' ';
        for (var i = 0; i < data.length; i++) {
            //users += '<li id="' + data[i].id + '" style="color: ' + data[i].color + '"><a href="javascript:call(\'' + (data[i].id) + '\');">' + (data[i].user) + '</a></li>';
            html += '<span style="color: ' + data[i].color + '">'+data[i].user+'  '
        }
        $('#online_users').html(html);
    });

    socket.on('update-pencil', function (data) {
        current.color = data.color;
        current.lineWidth = data.lineWidth;
        $('#color').val(data.color).data('paletteColorPickerPlugin').reload();
    });

    //socket drawing handler
    socket.on('drawing', onDrawingEvent);

    //draw from history
    socket.on('draw-history', function (data) {
        onResize();
        let i = 0;

        function go() {
            if (++i < data.length) {
                if (typeof data[i].src === 'undefined') {
                    onDrawingEvent(data[i]);
                } else {
                    drawImage(data[i]);
                }
                setTimeout(go, 10);
            }
        }

        go();
    });

    socket.on('clear-history', function (e) {
        console.log('clear');
        onResize();
    });

    socket.on('draw-image', drawImage);

    socket.on('sound', soundHandler)

    socket.on('disconnect', function (e) {
        location.reload();
    });


    //drawing listeners
    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mouseout', onMouseUp, false);
    canvas.addEventListener('mousemove', onMouseMove, false);

    //todo touch support


    //screen resize
    window.addEventListener('resize', onResize, false);


    $('[name="color-picker"]').paletteColorPicker({
        clear_btn: null,
        colors: ["#FFF", "#F44336", "#EF5350", "#F44336", "#E53935", "#D32F2F", "#C62828", "#B71C1C", "#FF5252", "#FF1744", "#E91E63", "#EC407A", "#E91E63", "#D81B60", "#C2185B", "#AD1457", "#880E4F", "#FF4081", "#F50057", "#C51162", "#9C27B0", "#BA68C8", "#AB47BC", "#9C27B0", "#8E24AA", "#7B1FA2", "#6A1B9A", "#4A148C", "#E040FB", "#D500F9", "#AA00FF", "#673AB7", "#9575CD", "#7E57C2", "#673AB7", "#5E35B1", "#512DA8", "#4527A0", "#311B92", "#7C4DFF", "#651FFF", "#6200EA", "#3F51B5", "#7986CB", "#5C6BC0", "#3F51B5", "#3949AB", "#303F9F", "#283593", "#1A237E", "#536DFE", "#3D5AFE", "#304FFE", "#1E88E5", "#1976D2", "#1565C0", "#0D47A1", "#448AFF", "#2979FF", "#2962FF", "#0288D1", "#0277BD", "#01579B", "#0091EA", "#0097A7", "#00838F", "#006064", "#009688", "#009688", "#00897B", "#00796B", "#00695C", "#004D40", "#43A047", "#388E3C", "#2E7D32", "#1B5E20", "#558B2F", "#33691E", "#827717", "#E65100", "#F4511E", "#E64A19", "#D84315", "#BF360C", "#FF3D00", "#DD2C00", "#795548", "#A1887F", "#8D6E63", "#795548", "#6D4C41", "#5D4037", "#4E342E", "#3E2723", "#757575", "#616161", "#424242", "#212121", "#607D8B"],
        position: 'upside',
        onchange_callback: function (color) {
            current.color = color;
            socket.emit('change-color', color);
            console.log();
        }
    });

    $('.input-btn.image').click(function () {
        $('#m').val('!image ').focus();
    })
    $('.input-btn.youtube').click(function () {
        $('#m').val('!play ').focus();
    })
    $('.input-btn.wolfram').click(function () {
        $('#m').val('!wolfram ').focus();
    })
});


/*!
 * JQuery Palette Color Picker v1.13 by Carlos Cabo ( @putuko )
 * https://github.com/carloscabo/jquery-palette-color-picker
 */
(function (t) {
    "use strict";
    t.paletteColorPicker = function (e, a) {
        var s = "palette-color-picker", i = t(e), n = this, o = null, l = i.val(), r = i.attr("name"),
            c = t("<div>").addClass(s + "-button").attr("data-target", r), u = t("<div>").addClass(s + "-bubble"),
            f = {}, d = {
                custom_class: null,
                colors: null,
                position: "upside",
                insert: "before",
                clear_btn: "first",
                timeout: 2e3,
                set_background: false,
                close_all_but_this: false
            }, g = "ontouchstart" in document.documentElement ? "touchstart click" : "click";
        n.init = function () {
            n.settings = t.extend({}, d, a);
            var e = i.attr("value");
            if (typeof e === typeof undefined || e === false) {
                e = "";
                i.attr("value", e)
            }
            i.attr("data-initialvalue", i.attr("value"));
            if (n.settings.colors === null) {
                n.settings.colors = i.data("palette")
            }
            if (typeof n.settings.colors[0] === "string") {
                n.settings.colors = t.map(n.settings.colors, function (t, e) {
                    var a = {};
                    a[t] = t;
                    return a
                })
            }
            n.settings.insert = n.settings.insert.charAt(0).toUpperCase() + n.settings.insert.slice(1);
            if (n.settings.custom_class) {
                u.addClass(n.settings.custom_class)
            }
            t.each(n.settings.colors, function (e, a) {
                var s = Object.keys(a)[0], i = a[s], n = t("<span>").addClass("swatch").attr({
                    title: s,
                    "data-color": i,
                    "data-name": s
                }).css("background-color", i);
                if (s === l) {
                    n.addClass("active");
                    c.css("background", i)
                }
                n.appendTo(u)
            });
            if (n.settings.clear_btn !== null) {
                var o = t("<span>").addClass("swatch clear").attr("title", "Clear selection");
                if (n.settings.clear_btn === "last") {
                    o.addClass("last").appendTo(u)
                } else {
                    o.prependTo(u)
                }
            }
            n.destroy = function () {
                c.remove();
                t.removeData(i[0])
            };
            n.clear = function () {
                u.find(".active").removeClass("active");
                c.removeAttr("style");
                i.val("")
            };
            n.reset = function () {
                if (i.attr("data-initialvalue") === "") {
                    n.clear()
                } else {
                    var t = i.attr("data-initialvalue");
                    u.find('[data-name="' + t + '"]').trigger("click")
                }
            };
            n.reload = function () {
                var t = i.val();
                if (t === "" || typeof t === typeof undefined || t === false) {
                    n.reset()
                } else {
                    if (u.find('[data-name="' + t + '"]').length) {
                        u.find('[data-name="' + t + '"]').trigger("click")
                    } else {
                        n.reset()
                    }
                }
            };
            c.append(u).on(g, function (e) {
                e.preventDefault();
                e.stopPropagation();
                var a = t(this);
                if (!t(e.target).hasClass(s + "-bubble")) {
                    if (typeof n.settings.onbeforeshow_callback === "function") {
                        n.settings.onbeforeshow_callback(this)
                    }
                    a.toggleClass("active");
                    var i = a.find("." + s + "-bubble");
                    if (n.settings.close_all_but_this) {
                        t("." + s + "-bubble").not(i).fadeOut()
                    }
                    i.fadeToggle();
                    if (a.hasClass("active")) {
                        clearTimeout(n.timer);
                        n.timer = setTimeout(function () {
                            a.trigger("pcp.fadeout")
                        }, n.settings.timeout)
                    }
                }
            }).on("pcp.fadeout", function () {
                t(this).removeClass("active").find("." + s + "-bubble").fadeOut()
            }).on("mouseenter", "." + s + "-bubble", function () {
                clearTimeout(n.timer)
            }).on("mouseleave", "." + s + "-bubble", function () {
                n.timer = setTimeout(function () {
                    c.trigger("pcp.fadeout")
                }, n.settings.timeout)
            }).on(g, "." + s + "-bubble span.swatch", function (e) {
                e.preventDefault();
                e.stopPropagation();
                var a = t(this).attr("data-color"), i = t(this).attr("data-name"),
                    o = t("." + s + '-button[data-target="' + t(this).closest("." + s + "-button").attr("data-target") + '"]'),
                    l = t(this).closest("." + s + "-bubble");
                l.find(".active").removeClass("active");
                if (t(e.target).is(".clear")) {
                    o.removeAttr("style");
                    a = ""
                } else {
                    t(this).addClass("active");
                    o.css("background", a)
                }
                if (typeof n.settings.onchange_callback === "function") {
                    n.settings.onchange_callback(a)
                }
                if (n.settings.set_background === false) {
                    t('[name="' + o.attr("data-target") + '"]').val(i)
                } else {
                    t('[name="' + o.attr("data-target") + '"]').css({"background-color": a})
                }
            })["insert" + n.settings.insert](i);
            if (n.settings.position === "downside" || i.offset().top + 20 < u.outerHeight()) {
                u.addClass("downside")
            }
        };
        t("body").on(g, function (e) {
            if (!t(e.target).hasClass(s + "-button")) {
                t(c).removeClass("active").find("." + s + "-bubble").fadeOut()
            }
        });
        n.init()
    };
    t.fn.paletteColorPicker = function (e) {
        return this.each(function () {
            if (typeof t(this).data("paletteColorPickerPlugin") === "undefined") {
                t(this).data("paletteColorPickerPlugin", new t.paletteColorPicker(this, e))
            }
        })
    }
})(jQuery);
