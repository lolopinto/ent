def render_list_csv(l):
    str_l = ["'%s'" % (v) for v in l]
    return ", ".join(str_l)


def render_list_csv_as_list(l):
    str_l = ["'%s'" % (v) for v in l]
    return "[%s]" % ", ".join(str_l)
