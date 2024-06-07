def render_list_csv(l):
    str_l = [f"'{v}'" for v in l]
    return ", ".join(str_l)


def render_list_csv_as_list(l):
    str_l = [f"'{v}'" for v in l]
    return f"[{', '.join(str_l)}]"
