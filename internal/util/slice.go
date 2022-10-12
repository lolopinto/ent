package util

import "sort"

func StringsEqual(slice, slice2 []string) bool {
	if len(slice) != len(slice2) {
		return false
	}
	sort.Strings(slice)
	sort.Strings(slice2)
	for idx, item := range slice {
		if item != slice2[idx] {
			return false
		}
	}
	return true
}
